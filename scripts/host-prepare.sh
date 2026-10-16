#!/bin/sh
# Go-live host preparation (run ONCE on the Linux Docker host as root).
# Covers: Docker Engine 24+ + Compose v2, firewall, dirs, file perms.
# Idempotent: safe to re-run. Does NOT touch secrets or DB.
set -eu

echo "[1/5] OS + Docker check..."
docker --version
docker compose version
test "$(id -u)" = "0" || { echo "run as root (sudo)"; exit 1; }

echo "[2/5] firewall: only 80/443 public, DB/backend closed..."
if command -v ufw >/dev/null 2>&1; then
  ufw allow 80,443/tcp
  ufw deny 3000/tcp || true
  ufw deny 3001/tcp || true
  ufw deny 5432/tcp || true
  ufw deny 6379/tcp || true
  ufw --force enable
  ufw status numbered | head -n 30
else
  echo "WARN: ufw not found — open 80/443 and block 3000/3001/5432/6379 in your cloud SG instead."
fi

echo "[3/5] directories + perms..."
mkdir -p backups nginx/certs /var/www/certbot
chmod 700 backups || true
chmod 755 nginx/certs /var/www/certbot || true
test -f .env.production && chmod 600 .env.production || echo "NOTE: .env.production not present yet (copy from .env.production.example on the host)."

echo "[4/5] certs present?"
ls -l nginx/certs/ || echo "NOTE: place fullchain.pem + privkey.pem in nginx/certs/ (prod: certbot webroot, see DEPLOY.md §3)."

echo "[5/5] compose config validation (no secrets printed)..."
docker compose --env-file .env.production config >/dev/null
echo "host-prepare OK. Next: node backend/scripts/env-check.mjs --file .env.production"
