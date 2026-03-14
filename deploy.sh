#!/usr/bin/env bash
set -euo pipefail

APP_DIR_RAW="${PROJECT_PATH:-$HOME/convoy-backend}"
APP_DIR="${APP_DIR_RAW/#\~/$HOME}"
SUPABASE_COMPOSE_FILE="${SUPABASE_COMPOSE_FILE:-infra/supabase/docker-compose.yml}"
SUPABASE_ENV_FILE="${SUPABASE_ENV_FILE:-infra/supabase/.env}"
MIGRATIONS_SRC_DIR="${MIGRATIONS_SRC_DIR:-database/migrations}"

echo "[deploy] cd -> ${APP_DIR}"
cd "${APP_DIR}"

echo "[deploy] fetch latest code"
git fetch --all
git reset --hard "origin/main"

echo "[deploy] install node dependencies"
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

echo "[deploy] prepare migration directory for supabase cli"
mkdir -p supabase/migrations
if [ -d "${MIGRATIONS_SRC_DIR}" ]; then
  rsync -a --delete "${MIGRATIONS_SRC_DIR}/" supabase/migrations/
elif [ -d "supabase/migrations" ]; then
  echo "[deploy] using existing supabase/migrations directory"
else
  echo "[deploy] ERROR: no migrations directory found. Expected ${MIGRATIONS_SRC_DIR} or supabase/migrations"
  exit 1
fi

echo "[deploy] pull and start supabase containers"
if [ ! -f "${SUPABASE_ENV_FILE}" ]; then
  echo "[deploy] ERROR: missing ${SUPABASE_ENV_FILE}"
  exit 1
fi
docker compose --env-file "${SUPABASE_ENV_FILE}" -f "${SUPABASE_COMPOSE_FILE}" pull
docker compose --env-file "${SUPABASE_ENV_FILE}" -f "${SUPABASE_COMPOSE_FILE}" up -d

echo "[deploy] apply database migrations with supabase CLI"
if [ -f .env ]; then
  echo "[deploy] loading app .env"
  set -a
  source .env
  set +a
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "[deploy] ERROR: DATABASE_URL is not set in app environment"
  exit 1
fi
PGSSLMODE=disable npx --yes supabase db push --db-url "${DATABASE_URL}"

echo "[deploy] ensure pm2 log directory exists"
mkdir -p logs

echo "[deploy] restart application with pm2"
pm2 startOrRestart ecosystem.config.cjs --env production
pm2 restart convoy-backend --update-env
pm2 save

echo "[deploy] done"

