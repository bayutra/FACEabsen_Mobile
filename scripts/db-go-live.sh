#!/bin/sh
# Go-live DB: migrate deploy + seed prod + verify. Fail-closed di tiap tahap.
# Run di host: sh scripts/db-go-live.sh   (butuh .env.production terisi)
set -eu
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
set -a; . ./.env.production; set +a

echo "[1/4] env-check..."
node backend/scripts/env-check.mjs --file .env.production

echo "[2/4] start postgres+redis..."
docker compose --env-file .env.production up -d postgres redis
docker compose --env-file .env.production exec -T postgres pg_isready -U "${POSTGRES_USER:-face_absen_app}" -d "${POSTGRES_DB:-face_absen}"

echo "[3/4] migrate deploy (via backend entrypoint image, tanpa start penuh)..."
docker compose --env-file .env.production build backend
docker compose --env-file .env.production run --rm --no-deps backend sh -c './node_modules/.bin/prisma migrate deploy'

echo "[4/4] seed prod (idempoten, tanpa demo) + verify counts..."
docker compose --env-file .env.production run --rm --no-deps backend sh -c 'node prisma/seed.prod.mjs'
docker compose --env-file .env.production exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "SELECT (SELECT count(*) FROM roles) AS roles, (SELECT count(*) FROM permissions) AS perms, (SELECT count(*) FROM users) AS users;"
echo "db-go-live OK. Selanjutnya: kosongkan BOOTSTRAP_ADMIN_PASSWORD di .env.production lalu up penuh."
