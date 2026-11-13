#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

if find prisma/migrations -mindepth 2 -name migration.sql -print -quit 2>/dev/null | grep -q .; then
  ./node_modules/.bin/prisma migrate deploy
else
  ./node_modules/.bin/prisma db push --skip-generate
fi

exec node dist/main.js
