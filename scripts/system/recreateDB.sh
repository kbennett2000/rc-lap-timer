#!/bin/bash
set -euo pipefail

# Deletes the database and recreates it empty, with the current schema.
# To keep your data, run ./backupDB.sh first; ./restoreDB.sh brings a backup back.

read -r -p "This deletes every driver, car, location, session and race. Type recreate to continue: " answer || true
if [ "${answer:-}" != "recreate" ]; then
  echo "Nothing changed."
  exit 1
fi

echo "Stopping the app while the database is recreated"
sudo systemctl stop rc-lap-timer || true
trap 'sudo systemctl start rc-lap-timer || true' EXIT

echo "Enter the MySQL root password:"
mysql -u root -p -e "DROP DATABASE IF EXISTS rc_lap_timer; CREATE DATABASE rc_lap_timer;"

cd ~/rc-lap-timer
npx prisma migrate deploy
echo "Done. The database is empty."
