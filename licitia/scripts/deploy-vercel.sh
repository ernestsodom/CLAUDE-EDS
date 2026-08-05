#!/usr/bin/env bash
# =============================================================================
# LicitIA — Despliegue a Vercel
# Requiere: vercel CLI autenticado (vercel login).
# Uso: ./scripts/deploy-vercel.sh [--prod]
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ Verificando variables de entorno requeridas en Vercel…"
REQUIRED_VARS=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  OPENAI_API_KEY
  NEXT_PUBLIC_APP_URL
  INTERNAL_API_SECRET
)
EXISTING="$(vercel env ls 2>/dev/null || true)"
for var in "${REQUIRED_VARS[@]}"; do
  if ! grep -q "$var" <<<"$EXISTING"; then
    echo "  ⚠ Falta $var — agrégala con: vercel env add $var"
  fi
done

echo "→ Ejecutando pruebas y typecheck…"
npm run typecheck
npm test

if [[ "${1:-}" == "--prod" ]]; then
  echo "→ Desplegando a PRODUCCIÓN…"
  vercel deploy --prod
else
  echo "→ Desplegando preview…"
  vercel deploy
fi
