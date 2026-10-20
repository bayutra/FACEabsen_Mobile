#!/bin/sh
# Smoke API pasca-deploy: health + login + me + privacy notice.
# Tanpa data biometrik dan tanpa web dashboard.
# Usage: sh scripts/smoke-api.sh https://absen.rumahsakit.example
# Butuh: BOOTSTRAP_ADMIN_EMAIL + BOOTSTRAP_ADMIN_PASSWORD (env shell, bukan file).
set -eu
BASE="${1:?usage: sh scripts/smoke-api.sh <base-url>}"
EMAIL="${BOOTSTRAP_ADMIN_EMAIL:?set BOOTSTRAP_ADMIN_EMAIL}"
PASS="${BOOTSTRAP_ADMIN_PASSWORD:?set BOOTSTRAP_ADMIN_PASSWORD}"
PASS_N=0; FAIL_N=0
ok() { PASS_N=$((PASS_N+1)); echo "PASS  $1"; }
bad() { FAIL_N=$((FAIL_N+1)); echo "FAIL  $1${2:+ — $2}"; }

echo "-- health --"
HEALTH=$(curl -sk -m 10 "$BASE/api/v1/health") || HEALTH=""
echo "$HEALTH"
case "$HEALTH" in *'"db":"up"'*) ok "health db=up";; *) bad "health db=up" "$HEALTH";; esac

echo "-- login --"
LOGIN=$(curl -sk -m 15 -X POST "$BASE/api/v1/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}") || LOGIN=""
TOKEN=$(printf '%s' "$LOGIN" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
if [ -n "$TOKEN" ]; then ok "login bootstrap admin"; else bad "login bootstrap admin" "$LOGIN"; fi

echo "-- me --"
ME=$(curl -sk -m 10 "$BASE/api/v1/auth/me" -H "Authorization: Bearer $TOKEN") || ME=""
case "$ME" in *"$EMAIL"*) ok "auth/me";; *) bad "auth/me" "$ME";; esac

echo "-- privacy notice --"
NOTICE_CODE=$(curl -sk -m 10 -o /dev/null -w '%{http_code}' \
  "$BASE/api/v1/privacy/notice" -H "Authorization: Bearer $TOKEN")
case "$NOTICE_CODE" in 200) ok "privacy/notice";; *) bad "privacy/notice" "http=$NOTICE_CODE";; esac

echo ""
echo "$PASS_N/4 smoke checks passed"
test "$FAIL_N" -eq 0
