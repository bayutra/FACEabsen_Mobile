#!/bin/sh
# Rotate staging secrets + invalidate sessions. Run di host staging, BUKAN prod aktif.
# (Prod rotation butuh change window + restart; gunakan prosedur yang sama per-secret.)
set -eu
cd "$(dirname "$0")/.."
test -f .env.production || { echo ".env.production tidak ada"; exit 1; }
cp .env.production ".env.production.bak-$(date +%Y%m%d-%H%M%S)"
gen() { node -e "console.log(require('crypto').randomBytes($1).toString('$2'))"; }
NEW_JWT=$(gen 48 base64)
NEW_DATA=$(gen 32 base64)
NEW_PG=$(gen 24 base64)
NEW_REDIS=$(gen 24 base64)
echo "ganti 4 nilai ini di .env.production lalu restart:"
echo "JWT_ACCESS_SECRET=$NEW_JWT"
echo "DATA_ENCRYPTION_KEY=$NEW_DATA"
echo "POSTGRES_PASSWORD=$NEW_PG"
echo "REDIS_PASSWORD=$NEW_REDIS"
echo ""
echo "Catatan: DATA_ENCRYPTION_KEY baru TIDAK bisa membaca template lama"
echo "(re-enroll wajah staging). POSTGRES/REDIS password juga harus diset"
echo "di service masing-masing sebelum restart. Backup .env lama tersimpan."
