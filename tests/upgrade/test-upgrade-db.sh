#!/bin/bash
# Tests the upgrade's database step (scripts/system/upgrade-db.sh) on the kinds of database real timers have:
#   1. one from before Prisma migrations, made by that time's schema (pre-migrations.prisma) as those timers' own
#      upgrades made theirs, with data in it (pre-migrations-data.sql);
#   2. one already on migrations, with a newer migration still to apply;
# and that running the step again changes nothing. Each case gets its own database on the server DATABASE_URL points
# at, made here and dropped afterwards (through DATABASE_URL's own database, which is otherwise left alone). CI runs
# it; locally, with the MariaDB from tests/api/api.test.ts:
#   DATABASE_URL=mysql://root:devpass@127.0.0.1:3307/rc_lap_timer tests/upgrade/test-upgrade-db.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

admin=$DATABASE_URL
server=${DATABASE_URL%/*}
OLD=rc_lap_timer_upgrade_old
PENDING=rc_lap_timer_upgrade_pending
work=$(mktemp -d)

sql() {
  echo "$2" | npx prisma db execute --stdin --url "$1" > /dev/null
}
cleanup() {
  sql "$admin" "DROP DATABASE IF EXISTS $OLD; DROP DATABASE IF EXISTS $PENDING;" || true
  rm -rf "$work"
}
trap cleanup EXIT
fresh() {
  sql "$admin" "DROP DATABASE IF EXISTS $1; CREATE DATABASE $1 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
}
upgrade() {
  DATABASE_URL="$server/$1" bash scripts/system/upgrade-db.sh
}
check() {
  DATABASE_URL="$server/$1" node tests/upgrade/check-upgraded.mjs "${@:2}"
}

echo "== A timer from before migrations, with data"
fresh $OLD
DATABASE_URL="$server/$OLD" npx prisma db push --schema tests/upgrade/pre-migrations.prisma --skip-generate > /dev/null
sql "$server/$OLD" "$(cat tests/upgrade/pre-migrations-data.sql)"
upgrade $OLD
check $OLD --with-data

echo "== Upgrading it again changes nothing"
upgrade $OLD
check $OLD --with-data

echo "== A timer already on migrations, with one to apply"
fresh $PENDING
first=$(ls -1 prisma/migrations | grep -v '\.toml$' | head -n 1)
mkdir -p "$work/prisma/migrations"
cp prisma/schema.prisma "$work/prisma/"
cp prisma/migrations/migration_lock.toml "$work/prisma/migrations/"
cp -r "prisma/migrations/$first" "$work/prisma/migrations/"
DATABASE_URL="$server/$PENDING" npx prisma migrate deploy --schema "$work/prisma/schema.prisma" > /dev/null
upgrade $PENDING
check $PENDING

echo "The upgrade's database step passed every case"
