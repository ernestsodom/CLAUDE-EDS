#!/usr/bin/env bash
# =====================================================================
# run.sh — Verificacion completa de la capa de datos.
#
# Levanta un PostgreSQL efimero, aplica el shim de Supabase, todas las
# migraciones, el seed y las suites de pruebas. Pensado para CI: no
# requiere Supabase, solo PostgreSQL >= 15.
#
# Uso:
#   ./supabase/tests/run.sh                 # cluster efimero (por defecto)
#   DATABASE_URL=postgres://... ./run.sh    # contra una base existente
# =====================================================================
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUPA="$(dirname "$HERE")"

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
bold()  { printf '\033[1m%s\033[0m\n' "$*"; }

# ---------------------------------------------------------------------
# Cluster efimero si no se pasa DATABASE_URL
# ---------------------------------------------------------------------
if [ -z "${DATABASE_URL:-}" ]; then
  PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1 || true)"
  export PATH="${PGBIN:-}:$PATH"
  command -v initdb >/dev/null || { red "PostgreSQL no encontrado (initdb)."; exit 1; }

  TMPDIR_PG="$(mktemp -d)"
  trap 'pg_ctl -D "$TMPDIR_PG/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$TMPDIR_PG"' EXIT

  initdb -D "$TMPDIR_PG/data" -U postgres --auth=trust >/dev/null
  mkdir -p "$TMPDIR_PG/run"
  pg_ctl -D "$TMPDIR_PG/data" \
    -o "-k $TMPDIR_PG/run -p 55432 -c listen_addresses=''" \
    -l "$TMPDIR_PG/pg.log" start >/dev/null
  export DATABASE_URL="postgresql://postgres@/padel?host=$TMPDIR_PG/run&port=55432"
  psql "postgresql://postgres@/postgres?host=$TMPDIR_PG/run&port=55432" -qc 'create database padel'
  APPLY_SHIM=1
  # El cluster efimero solo escucha en socket unix (listen_addresses=''),
  # asi que PostgREST tiene que conectarse por ahi y no por TCP.
  PGRST_URI_DEFAULT="postgres://authenticator:authpass@/padel?host=$TMPDIR_PG/run&port=55432"
else
  APPLY_SHIM="${APPLY_SHIM:-0}"
fi

run_sql() { psql -v ON_ERROR_STOP=1 -q "$DATABASE_URL" -f "$1"; }

bold "== Shim de Supabase =="
if [ "$APPLY_SHIM" = "1" ]; then
  run_sql "$HERE/00_supabase_shim.sql" >/dev/null
  green "  aplicado"
else
  echo "  omitido (proyecto Supabase real)"
fi

bold "== Migraciones =="
for f in "$SUPA"/migrations/*.sql; do
  if run_sql "$f" >/dev/null; then
    green "  ok  $(basename "$f")"
  else
    red "  FALLO $(basename "$f")"; exit 1
  fi
done

bold "== Seed =="
run_sql "$SUPA/seed.sql" >/dev/null
green "  ok  seed.sql"

bold "== Casos de negocio =="
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f "$HERE/01_business_cases.sql" 2>&1 \
  | grep -oP '(OK\s+.*|FALLO.*|TODOS.*)' || { red "FALLO en casos de negocio"; exit 1; }

bold "== Seguridad / RLS =="
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f "$HERE/02_rls_security.sql" 2>&1 \
  | grep -oP '(OK\s+.*|FALLO.*|TODAS.*)' || { red "FALLO en pruebas de seguridad"; exit 1; }

bold "== Negocios (trader / Atila) =="
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f "$HERE/06_atila_deals.sql" 2>&1 \
  | grep -oP '(OK\s+.*|FALLO.*|TODAS.*)' || { red "FALLO en las reglas de negocios"; exit 1; }

# ---------------------------------------------------------------------
# Consultas del frontend (opcional).
# Requiere el binario `postgrest` en el PATH. Reproduce las consultas que
# emiten las paginas con el JWT de cada usuario demo: detecta columnas
# inexistentes, embeds ambiguos y fugas de RLS que ni TypeScript ni
# `next build` pueden ver.
# ---------------------------------------------------------------------
if command -v postgrest >/dev/null && command -v node >/dev/null; then
  bold "== Consultas del frontend =="
  JWT_SECRET="${JWT_SECRET:-super-secret-jwt-token-with-at-least-32-characters-long}"
  psql -q "$DATABASE_URL" -c "alter role authenticator with login password 'authpass'" >/dev/null 2>&1 || true

  PGRST_LOG="${TMPDIR:-/tmp}/pgrst-test.log"
  PGRST_DB_URI="${PGRST_DB_URI:-${PGRST_URI_DEFAULT:-postgres://authenticator:authpass@127.0.0.1:55432/padel}}" \
  PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon \
  PGRST_JWT_SECRET="$JWT_SECRET" PGRST_SERVER_PORT=3999 \
    postgrest > "$PGRST_LOG" 2>&1 &
  PGRST_PID=$!
  # PostgREST no responde hasta que ha cargado el schema cache. Esperar un
  # numero fijo de segundos hace que la suite falle en maquinas lentas y
  # pierda tiempo en las rapidas: se espera al estado real.
  for _ in $(seq 1 40); do
    if curl -fsS "http://127.0.0.1:3999/projects?limit=1" >/dev/null 2>&1 \
       || curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:3999/" 2>/dev/null | grep -qE '^(200|401|404)$'; then
      break
    fi
    sleep 0.5
  done
  if ! curl -sS -o /dev/null "http://127.0.0.1:3999/" 2>/dev/null; then
    kill $PGRST_PID 2>/dev/null
    red "PostgREST no arranco. Log en $PGRST_LOG:"; tail -20 "$PGRST_LOG"; exit 1
  fi

  API_URL=http://127.0.0.1:3999 JWT_SECRET="$JWT_SECRET" node "$HERE/03_frontend_queries.mjs" || {
    kill $PGRST_PID 2>/dev/null; red "FALLO en las consultas del frontend"; exit 1;
  }

  bold "== Escrituras del frontend (altas y ediciones) =="
  API_URL=http://127.0.0.1:3999 JWT_SECRET="$JWT_SECRET" node "$HERE/04_frontend_writes.mjs" || {
    kill $PGRST_PID 2>/dev/null; red "FALLO en las escrituras del frontend"; exit 1;
  }

  bold "== Conciliacion, documentos y revision de IA =="
  API_URL=http://127.0.0.1:3999 JWT_SECRET="$JWT_SECRET" node "$HERE/05_reconciliation_ai.mjs" || {
    kill $PGRST_PID 2>/dev/null; red "FALLO en conciliacion / documentos / IA"; exit 1;
  }
  kill $PGRST_PID 2>/dev/null
else
  echo "  omitido (requiere postgrest y node en el PATH)"
fi

green ""
green "======================================"
green " VERIFICACION COMPLETA: TODO EN VERDE"
green "======================================"
