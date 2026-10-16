#!/bin/sh
# Generate a SELF-SIGNED cert for staging/tests only.
# Production domains: use certbot (see docs/DEPLOY.md), never this.
set -eu
mkdir -p nginx/certs
openssl req -x509 -nodes -days 90 -newkey rsa:2048 \
  -keyout nginx/certs/privkey.pem \
  -out nginx/certs/fullchain.pem \
  -subj "/CN=face-absen.local" \
  -addext "subjectAltName=DNS:face-absen.local,DNS:localhost,IP:127.0.0.1"
chmod 600 nginx/certs/privkey.pem
echo "self-signed cert written to nginx/certs (staging only)"
