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

green ""
green "======================================"
green " VERIFICACION COMPLETA: TODO EN VERDE"
green "======================================"
