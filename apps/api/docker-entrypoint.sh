#!/bin/sh
set -eu

echo "[entrypoint] applying migrations"
node_modules/.bin/prisma migrate deploy

echo "[entrypoint] seeding if the database is empty"
node dist-prisma/seed-if-empty.js

echo "[entrypoint] starting api"
exec node dist/main.js
