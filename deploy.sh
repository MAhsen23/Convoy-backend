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

echo "[deploy] validate app and supabase JWT configuration"
INFRA_JWT_SECRET="$(set -a; source "${SUPABASE_ENV_FILE}"; printf '%s' "${JWT_SECRET:-}")"
INFRA_ANON_KEY="$(set -a; source "${SUPABASE_ENV_FILE}"; printf '%s' "${SUPABASE_ANON_KEY:-}")"
INFRA_SERVICE_ROLE_KEY="$(set -a; source "${SUPABASE_ENV_FILE}"; printf '%s' "${SUPABASE_SERVICE_ROLE_KEY:-}")"

if [ -z "${JWT_SECRET:-}" ] || [ -z "${SUPABASE_ANON_KEY:-}" ] || [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "[deploy] ERROR: app .env is missing JWT_SECRET / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY"
  exit 1
fi

if [ -z "${INFRA_JWT_SECRET}" ] || [ -z "${INFRA_ANON_KEY}" ] || [ -z "${INFRA_SERVICE_ROLE_KEY}" ]; then
  echo "[deploy] ERROR: ${SUPABASE_ENV_FILE} is missing JWT_SECRET / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY"
  exit 1
fi

if [ "${SUPABASE_ANON_KEY}" != "${INFRA_ANON_KEY}" ] || [ "${SUPABASE_SERVICE_ROLE_KEY}" != "${INFRA_SERVICE_ROLE_KEY}" ]; then
  echo "[deploy] ERROR: app .env and ${SUPABASE_ENV_FILE} keys do not match"
  echo "[deploy]        Keep SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY identical in both files"
  exit 1
fi

CHECK_JWT_SECRET="${INFRA_JWT_SECRET}" \
CHECK_ANON="${INFRA_ANON_KEY}" \
CHECK_SERVICE="${INFRA_SERVICE_ROLE_KEY}" \
node -e "
const jwt = require('jsonwebtoken');
const secret = process.env.CHECK_JWT_SECRET;
const tokens = [
  ['SUPABASE_ANON_KEY', process.env.CHECK_ANON, 'anon'],
  ['SUPABASE_SERVICE_ROLE_KEY', process.env.CHECK_SERVICE, 'service_role'],
];
for (const [name, token, expectedRole] of tokens) {
  try {
    const decoded = jwt.verify(token, secret);
    if (decoded.role !== expectedRole) {
      throw new Error('role claim mismatch');
    }
  } catch (err) {
    console.error('[deploy] ERROR: ' + name + ' is invalid for JWT_SECRET (' + err.message + ')');
    process.exit(1);
  }
}
"

PGSSLMODE=disable npx --yes supabase db push --db-url "${DATABASE_URL}"

echo "[deploy] ensure pm2 log directory exists"
mkdir -p logs

echo "[deploy] restart application with pm2"
pm2 startOrRestart ecosystem.config.cjs --env production
pm2 restart convoy-backend --update-env
pm2 save

echo "[deploy] done"

