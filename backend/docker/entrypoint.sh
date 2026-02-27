#!/bin/sh
set -e

# Basic startup orchestration:
# 1) wait for DB
# 2) run migrations (idempotent)
# 3) start the API

WAIT_RETRIES=${DB_WAIT_RETRIES:-60}
WAIT_SECONDS=${DB_WAIT_SECONDS:-2}

if [ "${SKIP_DB_WAIT:-false}" != "true" ]; then
  echo "[backend] Waiting for PostgreSQL (${WAIT_RETRIES} retries)..."
  i=1
  while [ $i -le $WAIT_RETRIES ]; do
    if node -e "require('./src/config/database').testConnection().then(()=>process.exit(0)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
      echo "[backend] PostgreSQL is ready"
      break
    fi
    echo "[backend] PostgreSQL not ready yet (${i}/${WAIT_RETRIES})"
    i=$((i+1))
    sleep "$WAIT_SECONDS"
  done

  if [ $i -gt $WAIT_RETRIES ]; then
    echo "[backend] ERROR: PostgreSQL did not become ready in time" >&2
    exit 1
  fi
fi

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[backend] Running migrations..."
  node src/migrations/run.js
else
  echo "[backend] RUN_MIGRATIONS=false (skipping)"
fi

# Optional: ensure platform_admin credentials + referencia tenant exist.
# Idempotent: safe to run multiple times.
if [ "${RUN_PLATFORM_ADMIN_SEED:-true}" = "true" ]; then
  echo "[backend] Ensuring platform admin seed..."
  node scripts/init-platform-admin.js
else
  echo "[backend] RUN_PLATFORM_ADMIN_SEED=false (skipping)"
fi

echo "[backend] Starting API..."
exec node src/index.js
