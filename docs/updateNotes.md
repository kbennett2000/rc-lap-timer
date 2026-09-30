# Upgrading a timer (UpgrayeDD)
You need the build box: a computer with this repository and Node 22 (`nvm use` reads `.nvmrc`). It has to be on the
timer's Wi-Fi (`rc-lap-timer`), with its SSH key on the timer. Set that up once with:
```bash
ssh-copy-id pi@rclaptimer.local
```

1. On the build box, get the new version:
   ```bash
   git pull && nvm use && npm ci
   ```
   `.env` is no longer kept in git, so the one pull that crosses that change deletes the build box's `.env`. Copy it
   aside first and put it back afterwards (the build doesn't need it; `npm run dev` does):
   ```bash
   cp .env ~/rc-lap-timer.env && git pull && cp ~/rc-lap-timer.env .env
   ```
2. Send the new upgrade scripts to the timer, **every time**:
   ```bash
   scripts/system/sendUpgradeScripts.sh
   ```
   The timer runs the upgrade scripts the previous upgrade left in its home folder. Skip this, and a timer last
   upgraded before these scripts were rewritten runs its old upgrade, which drops the database.
3. On the timer, start the upgrade:
   ```bash
   ssh pi@rclaptimer.local
   ./upgrayedd.sh
   ```
   It asks for the database's root password (`password1` if you followed docs/raspberryPiSetup.md) to make a backup.
4. When it says so, run this on the build box. It builds the app and copies it to the timer:
   ```bash
   ./serverUpgrade.sh
   ```
5. Back on the timer, press a key. The upgrade finishes, checks the app starts, and asks whether to reboot or shut
   down.

The timer doesn't need internet, as long as the new version uses the same Prisma version as the old one (5.21.1 for
every version so far). An upgrade that changes it needs the timer online, to download Prisma's engine for the Pi.

## What the upgrade does
On the timer, before the build box's part:
- It backs the database up to `~/db-backups/rc_lap_timer.<date>.sql`, and stops if the backup looks empty. Nothing
  is dropped.
- It stops the app and moves it to `~/rc-lap-timer.previous`, for rolling back.
- It deletes the previous upgrade's leftovers: its build file, its database scripts in `~`, and the
  `/var/www/rc-lap-timer` copy older versions made.
- It carries the app's `.env` over to the new version (or writes the default one, with `password1`).

After the build box's part:
- It unpacks the new build and brings the database up to its schema (`scripts/system/upgrade-db.sh`, which CI tests
  on databases like real timers'):
  - A database from before Prisma migrations is moved onto them once, with `prisma db push`, which refuses anything
    that would lose data.
  - Then new migrations are applied. The upgrade stops, before the new app starts, if the database still doesn't
    match the schema.
- It reinstalls the System Settings helper, which can now also set the Pi's clock. The app does that from the first
  phone or browser that opens it after a boot (see "The timer's clock" in the README). The upgrade says so if
  `fake-hwclock`, which keeps that time across a power cut, isn't installed.
- It deletes `/home/pi/config-api.log`: older versions wrote the passwords set in System Settings to it.
- It makes the app listen on localhost only, so nginx stays the only way in. This only happens if the service's
  start command is the one in docs/raspberryPiSetup.md; otherwise it says what to change by hand.
- It asks for an admin PIN for the System Settings screen (6-32 letters or numbers), and keeps asking at each upgrade
  until one is set. The PIN is stored in `/etc/rc-lap-timer.env`.
- It gives the timer its own HTTPS certificate if it doesn't have one yet (timers flashed from the old SD image share
  one), made by `rc-tls.sh` now and at every boot. Phones that trusted the old certificate need to install the new
  one (see "Trusting the timer on a phone" in the README).
- It replaces the web server's settings (`/etc/nginx/sites-available/rc-lap-timer`) with the app's
  (`scripts/system/nginx/rc-lap-timer.conf`), which let the phone app sync over plain HTTP. The old file is kept as
  `rc-lap-timer.bak`, and goes back if nginx rejects the new one.
- It copies the new upgrade and database scripts to `~`, and the login message to `/etc/motd`.
- It restarts the app and checks it's up before asking about a reboot. If the app doesn't come up, nothing is
  rebooted and the script prints how to roll back:
  ```bash
  sudo systemctl stop rc-lap-timer && rm -rf ~/rc-lap-timer && mv ~/rc-lap-timer.previous ~/rc-lap-timer && sudo systemctl start rc-lap-timer
  sudo rm /etc/systemd/system/rc-lap-timer.service.d/listen.conf && sudo systemctl daemon-reload   # if it was just added
  ```
  By then the database has the new schema. If the old app doesn't work against it, restore the backup (below).

A timer page left open from before the upgrade runs the old app code until it's reloaded, so some of its requests
(the LED display, pausing a race, starting a run) are refused. Reload open pages after upgrading.

## Stopped at "Table 'Tombstone' already exists"?
Upgrades before this fix recorded only the first migration when moving a database onto migrations, then failed on
the second, with the app stopped. The database was already complete, so record that migration and finish the upgrade:
```bash
cd ~/rc-lap-timer && npx prisma migrate resolve --applied 1_sync && cd ~ && ./piUpgrade2.sh
```

## Restoring a backup
```bash
./restoreDB.sh                      # newest backup in ~/db-backups
./restoreDB.sh ~/db-backups/rc_lap_timer.20260101_120000.sql
```

## Lost your history after an older upgrade?
Earlier versions of the upgrade dropped the database and never restored it (step 2 above stops a timer from running
one of those again). The data was saved first, in `~/backup_data.sql` (older copies are in
`~/db-backups/backup_data.*.sql`). After upgrading to this version, restore it with the command below. `restoreDB.sh`
recognizes these older backups and converts them first (they were saved in a format that breaks on apostrophes in
session notes):
```bash
./restoreDB.sh ~/backup_data.sql
```
