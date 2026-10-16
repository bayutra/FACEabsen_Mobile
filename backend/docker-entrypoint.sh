#!/bin/sh
# STEP 25 — container entrypoint: migrate schema, then start API.
# Fails closed: the container does not boot on migration error.
set -eu

echo "[entrypoint] running prisma migrate deploy..."
./node_modules/.bin/prisma migrate deploy

echo "[entrypoint] starting backend (NODE_ENV=${NODE_ENV:-unset})..."
exec node dist/main
