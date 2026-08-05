#!/usr/bin/env bash
# =============================================================================
# LicitIA — Configuración inicial de Supabase
# Requiere: supabase CLI autenticado (supabase login) y un proyecto creado.
# Uso: ./scripts/setup-supabase.sh <project-ref>
# =============================================================================
set -euo pipefail

PROJECT_REF="${1:?Uso: ./scripts/setup-supabase.sh <project-ref>}"

cd "$(dirname "$0")/.."

echo "→ Vinculando proyecto $PROJECT_REF…"
supabase link --project-ref "$PROJECT_REF"

echo "→ Aplicando migraciones (esquema, funciones, RLS, storage)…"
supabase db push

echo "→ Cargando datos de ejemplo (seed)…"
supabase db execute --file supabase/seed.sql

cat <<'EOF'

✔ Base de datos lista.

Pasos manuales restantes:
 1. Crea tu primer usuario en Dashboard → Authentication → Users (o invita por email).
 2. Vincúlalo a la organización demo ejecutando en el SQL Editor:
      insert into profiles (id, organization_id, email, full_name, role)
      values ('<AUTH-UUID>', '11111111-1111-1111-1111-111111111111',
              '<email>', 'Administrador', 'admin');
 3. Copia las claves de Settings → API a tu .env.local (ver .env.example).
EOF
