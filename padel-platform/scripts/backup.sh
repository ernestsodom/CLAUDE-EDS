#!/usr/bin/env bash
# =====================================================================
# backup.sh — Copia de seguridad logica de la base (FASE 15).
#
# `pg_dump` en formato custom (-Fc): comprimido, restaurable con
# `pg_restore` y capaz de restaurar objetos sueltos sin tocar el resto.
# No sustituye el Point-in-Time Recovery de Supabase (que opera a nivel
# de WAL y permite restaurar a cualquier segundo) — es el complemento:
# una copia que se puede sacar de la infraestructura de Supabase,
# guardar donde convenga y restaurar sobre cualquier PostgreSQL, incluido
# uno fuera de Supabase si hiciera falta migrar.
#
# Uso:
#   DATABASE_URL=postgres://... ./scripts/backup.sh
#   DATABASE_URL=postgres://... ./scripts/backup.sh /ruta/destino
#
# Restaurar:
#   pg_restore --clean --if-exists -d "$DATABASE_URL" backup.dump
# =====================================================================
set -euo pipefail

: "${DATABASE_URL:?Falta DATABASE_URL. Usa la connection string de Supabase (Settings > Database).}"

DEST_DIR="${1:-./backups}"
mkdir -p "$DEST_DIR"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$DEST_DIR/padel-${STAMP}.dump"

echo "Volcando la base a ${FILE}..."
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --exclude-schema=auth \
  --exclude-schema=storage \
  --exclude-schema=realtime \
  --exclude-schema=supabase_functions \
  --file="$FILE"

echo "Listo: $(du -h "$FILE" | cut -f1) en ${FILE}"
echo ""
echo "auth y storage.objects los gestiona la plataforma de Supabase (PITR +"
echo "replicacion de Storage); este volcado cubre el esquema de negocio en"
echo "public y app. Retencion recomendada: 30 copias diarias minimo."
