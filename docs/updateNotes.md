# New Upgrade Process, featuring UPGRAYEDD
- One-time setup on the dev server: let it copy files to the Pi with an SSH key instead of a password
```bash
ssh-copy-id pi@rclaptimer.local
```

- Open up a session on the Pi

- Run 
```bash
./upgrayedd.sh
```

- When prompted, run 
```bash
./serverUpgrade.sh
``` 
on the dev server

`.env` is no longer kept in git. On the dev server (or any clone), the next `git pull` deletes it, so copy it
aside first and put it back afterwards (or `cp .env.example .env` and set `DATABASE_URL`). The build doesn't need
it, and the Pi keeps its own: the upgrade copies it from `~/rc-lap-timer.previous`.
```bash
cp .env ~/rc-lap-timer.env && git pull && cp ~/rc-lap-timer.env .env
```

What the upgrade does to your data and app:
- The database is backed up to `~/db-backups/rc_lap_timer.<date>.sql` (you'll be asked for the MySQL
  root password). Nothing is dropped. Schema changes are applied with `prisma migrate deploy`, and the
  upgrade stops before starting the new app if the database still doesn't match the schema.
- The first upgrade to a version with Prisma migrations (`prisma/migrations/0_init`) also records the
  existing database as that baseline, once. It uses `prisma db push`, which refuses changes that would
  lose data.
- The running app is moved to `~/rc-lap-timer.previous`, and its `.env` is copied into the new build.
- The first time, you're asked for an admin PIN for the System Settings screen. It's stored in
  `/etc/rc-lap-timer.env`.
- The app is set to listen on localhost only (nginx stays the only way in), and the old
  `/home/pi/config-api.log` is deleted: older versions wrote the passwords set in System Settings to it.
- The timer gets its own HTTPS certificate if it doesn't have one yet (timers flashed from the old SD
  image share one), made by `rc-tls.sh` here and at every boot. Phones that trusted the old certificate
  install the new one (see "Trusting the timer on a phone" in the README).
- The web server's settings (`/etc/nginx/sites-available/rc-lap-timer`) are replaced with the app's
  (`scripts/system/nginx/rc-lap-timer.conf`), which let the phone app sync over plain HTTP. The old file
  is kept as `rc-lap-timer.bak`, and goes back if nginx rejects the new one.
- The Remote LED display's routes take JSON posts now. A timer page left open from before the upgrade can't
  drive the display until it's reloaded, and `serverUpgrade.sh`'s progress messages only show once the Pi runs
  this version.
- The System Settings helper is reinstalled. It can now set the Pi's clock, which the app does from the first
  phone or browser that opens it after a boot (see "The timer's clock" in the README). The upgrade says so if
  `fake-hwclock`, which keeps that time across a power cut, isn't installed.
- The app is restarted and checked before the reboot prompt. If it doesn't come up, nothing is
  rebooted and the script prints the rollback command:
```bash
sudo systemctl stop rc-lap-timer && rm -rf ~/rc-lap-timer && mv ~/rc-lap-timer.previous ~/rc-lap-timer && sudo systemctl start rc-lap-timer
```

## Restoring a backup
```bash
./restoreDB.sh                      # newest backup in ~/db-backups
./restoreDB.sh ~/db-backups/rc_lap_timer.20260101_120000.sql
```

## Lost your history after an older upgrade?
Earlier versions of the upgrade dropped the database and never restored it. The data was saved first,
in `~/backup_data.sql` (older copies are in `~/db-backups/backup_data.*.sql`). After upgrading to this
version, restore it with the command below. `restoreDB.sh` recognizes these older backups and converts
them first (they were saved in a format that breaks on apostrophes in session notes):
```bash
./restoreDB.sh ~/backup_data.sql
```




# DEPRECATED!!!
# Update a build 

## Delete the old build:
```bash
rm -rf rc-lap-timer && rm rc-lap-timer-build.tar.gz && sudo rm -rf /var/www/rc-lap-timer/                       
```


## On the build machine
```bash
npm run build
```

```bash
tar -czf rc-lap-timer-build.tar.gz * .next package.json package-lock.json node_modules public
```

```bash
scp rc-lap-timer-build.tar.gz pi@rclaptimer.local:~
```


## Install the updated build
```bash
mkdir rc-lap-timer && cd rc-lap-timer
```

```bash
tar xzf ../rc-lap-timer-build.tar.gz && sudo mkdir -p /var/www/rc-lap-timer && sudo cp -r .next/* /var/www/rc-lap-timer/
```

```bash
cat > .env << 'EOF'
DATABASE_URL="mysql://rc_timer_user:password1@localhost:3306/rc_lap_timer"
EOF
```

```bash
npx prisma generate
```

Only the first time you upgrade to a version with Prisma migrations (`prisma/migrations/0_init`),
record your existing database as the baseline:
```bash
npx prisma db push --skip-generate && npx prisma migrate resolve --applied 0_init
```

```bash
npx prisma migrate deploy
```

```bash
sudo chown -R pi:pi /home/pi/rc-lap-timer
```

## Reboot!
```bash
sudo reboot now
```