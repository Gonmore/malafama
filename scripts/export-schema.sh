#!/usr/bin/env bash
set -euo pipefail

# Exports the current DB schema (DDL only) into database/schema.sql using pg_dump.
# Useful to snapshot the *real* working schema from local or staging.
#
# Usage:
#   DB_HOST=localhost DB_PORT=5432 DB_NAME=malafama DB_USER=postgres DB_PASSWORD=... ./scripts/export-schema.sh
#
# Output:
#   database/schema.sql

DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-malafama}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-}

OUT_FILE=${OUT_FILE:-database/schema.sql}

if [[ -z "${DB_PASSWORD}" ]]; then
  echo "DB_PASSWORD is required" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT_FILE")"

docker run --rm \
  -e PGPASSWORD="$DB_PASSWORD" \
  --network host \
  postgres:16-alpine \
  pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --schema-only \
    --no-owner \
    --no-privileges \
    --if-exists \
    --clean \
  > "$OUT_FILE"

echo "Wrote schema to $OUT_FILE"