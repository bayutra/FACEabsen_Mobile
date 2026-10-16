#!/bin/sh
# Restore a backup, then verify with row counts.
# Usage: sh scripts/restore-db.sh backups/face_absen-<stamp>.dump
# Recovery test: run this against a STAGING compose project, then smoke-test
# the app (GET /api/v1/health + login + check-in flow).
set -eu
cd "$(dirname "$0")/.."
FILE="${1:?usage: sh scripts/restore-db.sh <dump-file>}"
# shellcheck disable=SC1091
set -a; . ./.env.production; set +a
sha256sum -c "${FILE}.sha256"
docker compose --env-file .env.production cp "$FILE" postgres:/tmp/restore.dump
docker compose --env-file .env.production exec -T postgres \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists /tmp/restore.dump
docker compose --env-file .env.production exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT count(*) FROM attendance; SELECT count(*) FROM audit_logs;"
echo "restore done — counts above must match the backup source"
