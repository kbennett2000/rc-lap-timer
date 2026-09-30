#!/bin/bash
# The upgrade's database step: brings the timer's database up to the new build's schema without losing data.
# piUpgrade2.sh runs it after unpacking the new build, and CI runs it against the kinds of database real timers have
# (tests/upgrade/test-upgrade-db.sh). It works in the app folder it belongs to, and uses DATABASE_URL (from .env).
set -euo pipefail
cd "$(dirname "$0")/../.."

stop() {
  echo "*** UpgrayeDD $1, so the upgrade stopped here."
  echo "    Roll back: rm -rf ~/rc-lap-timer && mv ~/rc-lap-timer.previous ~/rc-lap-timer && sudo systemctl start rc-lap-timer"
  echo "    Your database backup is in ~/db-backups/. If the old app doesn't work against the database afterwards,"
  echo "    restore the newest backup:"
  echo "    mysql -u root -p rc_lap_timer < \"\$(ls -1t ~/db-backups/rc_lap_timer.*.sql | head -n 1)\""
  exit 1
}

# Databases from before Prisma migrations have no _prisma_migrations table. db push brings them up to the new schema,
# refusing anything that would lose data. The database then has everything the migrations would have made, so every
# migration is recorded as applied: recording only the first would make migrate deploy create the later ones' tables
# again, and fail.
if ! echo "SELECT 1 FROM _prisma_migrations LIMIT 1;" | npx prisma db execute --stdin --schema prisma/schema.prisma > /dev/null 2>&1; then
  echo "*** UpgrayeDD moving the database to Prisma migrations (one time)"
  if ! npx prisma db push --skip-generate; then
    stop "couldn't update the database schema without risking data (see above)"
  fi
  for migration in prisma/migrations/*/; do
    npx prisma migrate resolve --applied "$(basename "$migration")"
  done
fi

if ! npx prisma migrate deploy; then
  stop "couldn't apply the database changes (see above)"
fi

# Stop if the database still doesn't match the schema, before the new app starts against it.
if ! npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code > /dev/null; then
  echo "    See the differences: cd ~/rc-lap-timer && npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma"
  stop "says the database doesn't match the new schema"
fi
