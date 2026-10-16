#!/bin/sh
# Nightly-able Postgres backup (custom format + checksum). Run from repo root:
#   sh scripts/backup-db.sh            # uses .env.production for credentials
# Restore: sh scripts/restore-db.sh backups/face_absen-<stamp>.dump
set -eu
cd "$(dirname "$0")/.."
mkdir -p backups
# shellcheck disable=SC1091
set -a; . ./.env.production; set +a
STAMP=$(date +%Y%m%d-%H%M%S)
FILE="backups/face_absen-${STAMP}.dump"
docker compose --env-file .env.production exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f "/tmp/backup.dump"
docker compose --env-file .env.production cp "postgres:/tmp/backup.dump" "$FILE"
sha256sum "$FILE" > "${FILE}.sha256"
find backups -name 'face_absen-*.dump' | sort | head -n -14 | xargs -r rm -f
find backups -name 'face_absen-*.dump.sha256' | sort | head -n -14 | xargs -r rm -f
echo "backup: $FILE"
