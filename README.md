# 🏁 RC Lap Timer 🏎️

NOTE - Infrared (IR) beacon lap timing, on the Raspberry Pi timer, is in beta. The hardware is in
[docs/IRDocs](docs/IRDocs).

Looking for a free, easy to use lap timing system for backyard, parking lot, or garage RC racing? I created **RC Lap Timer** just for you! Transponder-based RC lap timing systems can be expensive and don't always work well with temporary tracks. **RC Lap Timer** is a lightweight, free alternative that enables casual RC racing without expensive equipment.

**RC Lap Timer** has two modes of recording laps, UI mode and Motion Detection mode (the Raspberry Pi timer adds a
third, IR, in beta). UI mode works with two people: a driver and a timer. While one person drives, the other records lap times as the car crosses the start/finish line. Motion Detection mode only requires a driver. It uses a camera on your phone, tablet, or laptop to detect when the car passes by, and records a lap time each time the car passes. 

Motion Detection mode is great for single drivers and practice sessions. UI mode allows each timer to time a different driver, and is ideal for situations where you want to have more than one car on the track. UI mode also supports "penalties", Motion Detection mode does not. 

> **NOTE**: This app is designed for casual racing and fun competition. While it's great for backyard racing and practice sessions, it's not intended to replace professional transponder-based timing systems.

![RC Car](https://img.icons8.com/color/48/000000/car.png)

# 📱 Quick start: just your phone

You don't need a Raspberry Pi to use RC Lap Timer. Open **https://kbennett2000.github.io/rc-lap-timer/** on your phone and add it to your home screen:

- **iPhone or iPad:** open the link in Safari, tap **Share**, then **Add to Home Screen**. Do this *before* you record sessions: the Home Screen app keeps its own data, separate from Safari's.
- **Android:** open the link in Chrome and tap **Install app** in Manager → Data (or use Chrome's menu: **Install app** or **Add to Home screen**).

The phone app times laps with taps (UI mode) or with the camera (Motion Detection mode), and once it's installed it works without an internet connection. Everything you record is stored **on your phone only**. Save a backup from **Manager → Data** every so often: you can restore it if something goes wrong, or use it to move your data to another phone. If you also have an RC Lap Timer box (the Raspberry Pi below), **Sync with the timer** in the same place shares everything both ways while the phone is on the timer's Wi-Fi (an
iPhone first needs the timer's certificate: see "Trusting the timer on a phone").

These need the Raspberry Pi timer below: race mode, IR timing, remote control, following a session live from another
phone, the LED display, and the timer's System Settings.

The app can also have accounts, cloud sync, and shared tracks with leaderboards, but only if whoever publishes it runs
a cloud service for them ([docs/cloud.md](docs/cloud.md)). The app at the link above doesn't, so it never sends your data anywhere.

# Feature Overview

Watch this short video to understand how RC Lap Timer works and some of the features available. It shows an earlier
version, so some screens have moved (see the Usage Guide). If you like what you see, follow the instructions below to
get started!

[![YouTube Application Overview Video](http://img.youtube.com/vi/lfPLHotND4M/0.jpg)](http://www.youtube.com/watch?v=lfPLHotND4M "RC Lap Timer Overview")


# 🚀 Raspberry Pi setup (advanced)

**The Raspberry Pi version is designed to run on a Raspberry Pi Zero 2 W.**

**No other Raspberry Pi models are currently supported!**

Running from a Raspberry Pi Zero 2 W allows for the creation of a wi-fi network (`rc-lap-timer`) that you and all your friends can connect to. Drivers, their cars, timing session results, and configuration settings are all stored in a MariaDB database on the Pi.
These instructions will guide you through writing the RC Lap Timer image to a microSD card for use with your Raspberry Pi Zero 2 W.


## Required Materials
- Raspberry Pi Zero 2 W
- 16GB or greater class 10 microSD card
- A device with WiFi capabilities, a web browser, and a camera
    - This includes Android and Apple tablets and phones, a Windows, Mac, or Linux computer with a webcam or USB camera.
- A computer with a microSD card reader
- The RC Lap Timer image file:
    - [Download from Google Drive](https://drive.google.com/file/d/1fJDJici0xtzP4xVhj4DvLpkFYnxi1WDa/view?usp=sharing)
    - The image is from 2024. After writing it, upgrade the timer (see "Upgrading a timer" below) to get everything
      this README describes, including the timer's own certificate, syncing with the phone app and the clock.
- Raspberry Pi Imager software
    - [https://www.raspberrypi.com/software/](https://www.raspberrypi.com/software/)


## Optional but Helpful Materials
- Mobile phone tripod
- Raspberry Pi Zero case


## Writing the image
- Install Raspberry Pi Imager: from [raspberrypi.com/software](https://www.raspberrypi.com/software/) on Windows and
  macOS, or `sudo apt install rpi-imager` (Ubuntu, Debian) or `sudo dnf install rpi-imager` (Fedora) on Linux.
- Insert your microSD card into your computer and launch Raspberry Pi Imager.
- **Choose Device**: Raspberry Pi Zero 2 W.
- **Choose OS**: scroll to the bottom, select **Use custom**, and choose the downloaded RC Lap Timer image file.
- **Choose Storage**: your microSD card.
- Click **Next**. When asked whether to apply OS customisation settings, choose **No**: the image is already set up,
  and custom Wi-Fi or hostname settings would stop the timer running its own Wi-Fi network.
- Confirm, and enter your administrator password if asked. Wait for writing and verifying to finish, then remove the
  card when prompted.


## After Writing the Image
- Safely remove the microSD card from your computer
- Insert the microSD card into your Raspberry Pi Zero 2 W
- Power on your Raspberry Pi Zero 2 W
- Connect to the `rc-lap-timer` wifi network using the password `rclaptimer`
![wifi connection](/images/wifiConnection.jpg)
- If you get a warning that the wifi network does not have internet access, ignore it and choose "Stay connected"
![wifi connection warning](/images/connectionWarning.jpg)
- Open up a browser and go to `https://rc-lap-timer`
- Accept the certificate warning and proceed to the site.

![certificate warning image 1](/images/certWarning1.jpg)

![certificate warning image 2](/images/certWarning2.jpg)

## Trusting the timer on a phone (optional)
Each timer makes its own certificate the first time it starts, with a small certificate authority that phones can
install. A phone that installs it no longer sees the warning above, and an iPhone needs it to sync with the phone app
(Manager → Data → **Sync with the timer**). Android phones can sync without it. On the timer's Wi-Fi:

- **iPhone or iPad:**
  1. In Safari, open `http://192.168.4.1/rc-lap-timer-ca.crt` and tap **Allow**.
  2. Open Settings, tap **Profile Downloaded**, then **Install**.
  3. In Settings → General → About → **Certificate Trust Settings**, turn on **RC Lap Timer (rclaptimer)** (the
     timer's name in brackets, if you've renamed it).
- **Android:** open `http://192.168.4.1/rc-lap-timer-ca.crt` in Chrome to download it, then in Settings search for
  **CA certificate** and install the downloaded file.

The certificate authority can only vouch for this timer: its key is deleted as soon as it has signed the timer's
certificate. A timer makes a new certificate about every two years (and once when it's upgraded from the old SD
image); install the new one then.

## The timer's clock
The Pi has no clock battery and no internet, so its clock stops while it's switched off. The timer's pages set it
forward to the phone's time as they open, and the phone app does the same when it syncs, so what the timer saves is
dated right. It only moves forward, once per boot, and never during a race. If a phone with a wrong clock ever sets it
ahead, set it back over SSH: `sudo date -s '2026-09-30 14:00' && sudo fake-hwclock save force`.

## Upgrading a timer
Follow [docs/updateNotes.md](docs/updateNotes.md), starting with its step that sends the new upgrade scripts to the
timer. Skipping it matters: a timer last upgraded before those scripts were rewritten would run its old upgrade, which
drops the database.



# 📊 Usage Guide
Everything here works in the phone app and on the timer (the Raspberry Pi), except where it says **timer only**.

## Finding your way around
![navigation](/images/navigation.jpg)

The bar at the bottom has **Practice** (timing, and your sessions), **Race** (timer only) and **Manager** (drivers,
cars, locations, settings and your data), and **Tracks** in a phone app published with a cloud service (see Tracks
below). Practice has its own tabs along the top: **Current** (set up and time a
session), **Session Mgmt**, **Best**, **Compare** and **Notes**.

A session keeps running while you look at another tab, and so does the camera.

## Adding Drivers, Cars, and Locations
Before timing a session you need a driver, a car for that driver, and a location. Add them on Practice → Current with
**New Driver**, **New Car** (once a driver is selected) and **New Location** (once a car is selected), or on
**Manager** → **Drivers & Cars** and **Locations**.
- Names must be unique, ignoring capitals: two drivers can't both be "Kris". Different drivers can have cars with the
  same name.
- Rename a driver, car or location with the pencil icon in Manager.
- On the timer, a car can also have a **Default IR Car Number** (1–8), for IR timing.

## Timing a Session
Set up the session on Practice → Current, from the top down.

### Announcements
![selecting announcement options](/images/announcements.jpg)

- **Announce Lap Numbers**: says each new lap's number, and when the session starts and ends.
- **Announce Last Lap Time**: says the time of the lap just finished.
- **Play Beeps**: beeps at the start, on each lap and at the end, and on each detection while you preview the camera.
- **Play sounds when the ringer is silenced (pauses other audio)**: iPhone only. Without it, a silenced iPhone plays
  no announcements or beeps.

### Enabling Remote Control (timer only)
![selecting remote control mode](/images/remoteControlSelection.jpg)

If you're driving by yourself, remote control saves walking back to the camera between sessions. Set up the camera
phone first, then tick **Enable Remote Control Mode** on it: it hides the session setup, switches to camera timing,
and shows "Polling for session requests...". From another phone on the timer's Wi-Fi, send a session from Practice →
Session Mgmt → **Request a Session**. The camera phone says "Session request received", turns its camera on, and the
session starts at the first detection.

Make sure the camera phone is placed and its camera settings are right before you rely on this. A session started
this way can't keep the screen on by itself (see below), so set the phone's screen to stay on.

### Driver, Car, Location, Number of Laps
![selecting driver car location number of laps](/images/driverCarLocationLaps.jpg)

Choose the driver, their car, the location and the number of laps: **Unlimited**, 3, 5, 10 or 25 laps, or
**Custom...** (1–999). A session with a number of laps ends by itself after the last one. An Unlimited session goes on
until you stop it.

### Timing Mode
![selecting the timing mode](/images/timingModeSelection.jpg)

- **Time Using UI**: someone taps a button each time the car crosses the line. It's the only mode with penalties, and
  the only one for several cars at once: each person times one car.
- **Time Using Motion Detection**: the camera spots the car crossing the line, so you can time yourself.
- **Time Using IR** (timer only, beta): the timer's infrared detector reads each car's beacon.

### While a session runs
The screen stays on by itself once you've tapped to start (the running session says "Screen stays on"). If the browser
can't do that, it says so, and you need to set the phone's screen to stay on. If the screen does go off, the app says
how long for, since laps in that time may be missing.

If the page reloads or the phone restarts during a session, Practice shows "A session was running" with **Resume**,
**Finish and save** and **Discard**. For a camera session, tap **Cam On** after Resume.

A session that couldn't be saved (on the timer, when its Wi-Fi drops, say) is kept on the phone. Practice shows
"Session not saved" with **Retry save** and **Discard** until it is.

### UI mode
![ui mode controls](/images/uiControls.jpg)

- **Start Lap Timer** starts the session (once a driver and a car are chosen).
- **Record Lap**: tap each time the car crosses the line.
- **Add Penalty** adds a penalty to the current lap. Penalties are whatever you decide (a crash, leaving the track,
  reversing). You can add more than one per lap.
- **Stop Lap Timer**: tap as the car crosses the line for the last time. That crossing counts as the last lap.

### Motion Detection mode
The first time, the browser asks to use the camera: allow it.

![camera permissions warning](/images/cameraPermissions.jpg)

#### Camera Controls
![camera controls](/images/cameraControls.jpg)

- **Preview** turns the camera on without timing, to check the setup: turn on Play Beeps, set a short Cooldown, and
  drive past a few times to see each pass is caught. Tap **Stop Preview** before timing.
- **Cam On** turns the camera on for the session. After the Frames to Skip, the first detection starts the session,
  and each one after that records a lap.
- **Stop Timer** (above the camera, while a session runs) ends the session. The lap in progress isn't counted: only
  real crossings are laps. A session with a number of laps ends, and turns the camera off, by itself.
- **Cam Off** only turns the camera off. The session keeps going, and Cam On carries on timing.
- **Rotate preview** turns the picture if it shows sideways. It doesn't change detection.
- **Camera**: with more than one camera, pick one. The phone remembers it.
- **Save MD Images** saves a photo of each detection, to check what set it off.

#### Motion Detection Settings
Changes take effect straight away, even with the camera on, and the phone remembers them for next time.
- **Sensitivity**: raise it if the car isn't detected, lower it if other things set it off. Higher means a smaller
  change in a pixel's colour counts.
- **Threshold**: how much of the picture has to change for a detection. A car that passes further from the camera
  needs a lower threshold. 0.5% to 5% usually works.
- **Cooldown**: how long after a detection to ignore the camera, in milliseconds, so one pass isn't counted twice.
  Make it shorter than your fastest lap: for laps of about 15 seconds, try 10000 to 12000.
- **Frames to Skip**: camera frames ignored after the camera turns on, so tapping the phone isn't counted as a lap.
  Most cameras send 30 frames a second, so the default of 60 is about 2 seconds.
- **Save** keeps the current settings under a name, and **Load settings...** brings a saved set back. Rename and
  delete saved sets in Manager → Motion Settings.

#### How the camera times a lap
The app compares each frame from the camera with the one before, on a copy scaled so its longer side is 320 pixels,
and counts the pixels whose colour changed by more than the Sensitivity allows. When that's more than the Threshold,
outside the Cooldown, the car has crossed. Most phone browsers (Chrome, and Safari on iOS 15.4 or later) say when the
camera took each frame, so a crossing is timed by the moment the car appeared in the picture, however busy the phone
was.

While you preview, the app shows how that's going, for example "Checking 30 frames a second, 1.2 ms each, timed by the
camera":
- **frames a second** should match the camera, usually 30. A much higher number means the browser can't say when
  frames arrive, so the app checks on every screen refresh instead.
- **ms each** is how long checking a frame takes. A few milliseconds is plenty fast.
- **timed by the camera** is the most accurate. "Timed by the screen" and "timed as they arrive" are close behind.
  "Timed when checked" means lap times can be off by a frame or two.

## Recent Sessions
![recent sessions](/images/recentSessions.jpg)

Below the setup, Practice → Current shows the running session's laps and stats, and your three most recent sessions,
with flags on the fastest lap, the slowest lap and the lap with the most penalties. Delete one with the trash icon.

## Session Mgmt
### Current Session (timer only)
![current session tab](/images/currentSession.jpg)

The session running on any phone connected to the timer, lap by lap, so others can follow along.

### Request a Session (timer only)
![requesting a session](/images/requestASession.jpg)

Sends a session to a phone set up for remote control (see above): choose a driver, car, location and number of laps,
then **Submit Request**.

### Previous Sessions
![previous sessions](/images/previousSessions.jpg)

Your saved sessions and their stats, filtered by driver, car, location and dates. **Sessions from today are shown at
first**: pick a date range (Last 7 days, This year and so on) to see older ones. Delete a session with its trash icon.

## Best
![best laps comparison tab](/images/bestLapsComparison.jpg)

The fastest lap of each session, fastest first, filtered by driver, car and dates (today at first).

## Compare
![session comparison tab](/images/sessionCompare.jpg)

Tap sessions to plot their lap times on one chart, to compare drivers, cars or setups (today's sessions at first).

## Notes
![session notes tab](/images/sessionNotes.jpg)

Notes for each session: tuning changes, track conditions, setup notes. Tap a session, then **Edit** and **Save**.

## Race (timer only)
Races between several cars timed by the timer's IR detector, with a countdown, live positions, DNFs and race history.
IR timing is still in beta.

## Manager
![application configuration tab](/images/appConfig.jpg)

- **Drivers & Cars** and **Locations**: add, rename and delete. Deleting a driver also deletes their cars, sessions
  and race results. Deleting a car deletes its sessions and race results, and deleting a location deletes the sessions
  and races there.
- **Motion Settings**: rename and delete saved camera settings.
- **Utilities**: the **RC Track Measurer** measures a track with the phone's GPS. Tap **Mark Start Line**, then walk
  until it reaches the distance you want.
- **Data**:
  - **Backups**: **Save a backup** saves everything to a file, and **Restore a backup** merges one back in, after
    showing what it will do. It never replaces what's there. The file is the same on the phone and the timer, so it
    also moves data between them: records with the same name become one.
  - In the phone app, also: **Install the app** (see Quick start), **Sync with the timer** (while the phone is on the
    timer's Wi-Fi, it shares everything both ways; an iPhone first needs the timer's certificate, see "Trusting the
    timer on a phone"), and **Your data** (**Keep data on this device** asks the browser not to clear the app's data
    when the phone runs low on space). The phone app reminds you if you haven't saved a backup for two weeks.
  - In a phone app published with a cloud service ([docs/cloud.md](docs/cloud.md)), also **Account and cloud
    sync**: sign in with a code sent to your email, then **Sync now** shares everything both ways between the phone
    and your account, so each phone you sign in on has the same data. **Sign out** and **Delete account** leave the
    phone's data as it is.
- **System Settings** (timer only): change the timer's name and the `pi` user's password. **Save & Reboot**
  restarts the timer, ending any session. It needs the admin PIN set on the Pi (see
  [docs/raspberryPiSetup.md](docs/raspberryPiSetup.md)).

When a new version of the phone app is ready, a bar at the top says so: tap **Reload** to use it.

## Tracks (phone app with a cloud service)
In a phone app published with a cloud service ([docs/cloud.md](docs/cloud.md)), a **Tracks** tab in the bottom bar
lists shared tracks. Tap one to see its leaderboard: each driver's best lap, fastest first. Anyone can look.
- **Adding a track:** signed in (Manager → Data), you can **Add a track**, with where it is if you like.
- **Posting a session:** each saved session in Practice and Session Mgmt has **Post to leaderboard**, which puts its
  best lap on a track's leaderboard. It shows exactly what becomes public first, and suggests the track you used last
  for that location.
- **Taking a post down:** use **Remove from leaderboard** on the session, or **Remove my post** on the leaderboard.
- **Changing a track:** whoever added it can rename it, and can delete it while nobody else has laps on it.


# 🛠️ Development & Contributing
Contributions are welcome! Please follow these steps:
- Fork the repository
- Create a feature branch: git checkout -b feature/feature-name
- Commit your changes: git commit -m 'Add some feature'
- Push to the branch: git push origin feature/feature-name
- Submit a pull request

## Running it locally
You need Node 22 (`nvm use` reads `.nvmrc`) and a MySQL or MariaDB database.
```bash
npm ci
cp .env.example .env      # then set DATABASE_URL
npx prisma migrate deploy
npm run dev
```

`NEXT_PUBLIC_TARGET=standalone npm run dev` runs the phone-only build instead: the Pi's features (Race, IR timing,
remote control, the live view, LEDs and System Settings) are hidden, and the data is stored on the device, in
IndexedDB ([src/data/local](src/data/local)). `npm run build:pages` builds it as a static site in `out/` (what
GitHub Pages serves), and `npm run serve:pages` serves that at http://127.0.0.1:3100/rc-lap-timer/.

Once CI passes on `main`, [.github/workflows/pages.yml](.github/workflows/pages.yml) publishes the phone-only app to
GitHub Pages (Settings → Pages → Source must be set to "GitHub Actions"). Its data layer is in [src/data](src/data):
the phone's on-device store in `src/data/local`, and backups and merging in [src/domain/sync](src/domain/sync). The Pi
merges backups with the same code ([src/lib/sync.ts](src/lib/sync.ts), behind `/api/sync`), and every delete on either
leaves a tombstone, so a backup can't bring deleted records back.

The phone app syncs with a timer by calling its `/api/sync` routes from GitHub Pages. The timer only answers sites
listed in `SYNC_ALLOWED_ORIGINS` (in `/etc/rc-lap-timer.env`; the default is `https://kbennett2000.github.io`), so a
fork that publishes its own phone app adds its Pages site there.

Accounts, cloud sync, shared tracks and leaderboards are in the phone app only when it's built with a Supabase project
(`NEXT_PUBLIC_CLOUD_URL` and `NEXT_PUBLIC_CLOUD_KEY`, which the Pages workflow takes from the `CLOUD_URL` and
`CLOUD_KEY` repository variables). Otherwise their code is left out of the build. The code is in
[src/cloud](src/cloud) and [src/features/cloud](src/features/cloud), and the database is in [supabase/](supabase).
[docs/cloud.md](docs/cloud.md) explains how to turn them on.

The Pi's API routes are the `src/app/api/**/route.pi.ts` files: only the Pi build treats `.pi.ts` files as pages and
routes (see `next.config.js`), so the static build leaves them out. Every route that changes data starts with
`refuseWrite` ([src/lib/api-helpers.ts](src/lib/api-helpers.ts)), which refuses other sites and bodies that aren't
JSON; [tests/api/write-guard.test.ts](tests/api/write-guard.test.ts) finds every such route and checks it does.
Commands for the Remote LED display count as changes too: the timer's pages post them to `/api/led/*` as JSON, and
those routes pass them on to the display with every value encoded.

Screens read and change data only through the `DataStore` in [src/data/types.ts](src/data/types.ts).
[tests/datastore/conformance.ts](tests/datastore/conformance.ts) lists the rules every store follows, as tests.

## Checks
CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs these on every pull request:
- `npm run format:check` (fix with `npm run format`), `npm run lint`, `npm run typecheck` and `npm test` (unit
  tests).
- Both builds, each checked to contain only its own code (`node scripts/check-bundles.mjs pi` and `standalone`),
  and the Pi build started on Node 20 as well, which existing Pis still run.
- With MariaDB 10.11 (what Raspberry Pi OS ships):
  - the migrations, checked against the schema;
  - the upgrade's database step on the kinds of database real timers have
    ([tests/upgrade/test-upgrade-db.sh](tests/upgrade/test-upgrade-db.sh));
  - the API tests;
  - the Pi's browser tests;
  - the phone app syncing with the Pi build.
- The phone app's browser tests. Its camera tests play a video of a car crossing
  ([tests/e2e/crossing-video.ts](tests/e2e/crossing-video.ts)) as the camera and check every lap; the motion check
  itself is [src/timing/motion.ts](src/timing/motion.ts).
- With a local Supabase: the cloud database's access rules (`supabase test db`), and the phone app built with it,
  checked to contain the cloud code (`check-bundles.mjs standalone-cloud`), with its sign-in, cloud sync and
  leaderboard browser tests ([tests/e2e/cloud.spec.ts](tests/e2e/cloud.spec.ts)).
- The Pi's web server settings, in the nginx version the Pi runs
  ([scripts/system/test-pi-network.sh](scripts/system/test-pi-network.sh), which needs Docker), and the system
  settings helper ([scripts/system/test-config-helper.sh](scripts/system/test-config-helper.sh)).

To run the database and browser tests locally:
```bash
# A database like the Pi's
docker run -d --name rclt-mariadb -e MARIADB_ROOT_PASSWORD=devpass -e MARIADB_DATABASE=rc_lap_timer \
  -p 127.0.0.1:3307:3306 mariadb:10.11
export DATABASE_URL="mysql://root:devpass@127.0.0.1:3307/rc_lap_timer"
npx prisma migrate deploy
npx playwright install chromium

# Both builds: the phone app's first, since both use .next
npm run build:pages
npm run build

# The Pi build, as the API and browser tests expect it
ADMIN_PIN=test1234 SYNC_ALLOWED_ORIGINS=https://kbennett2000.github.io,http://127.0.0.1:3200 \
  LED_DEVICE_IP=127.0.0.1:3199 npx next start -p 3100 -H 127.0.0.1 &
npm run test:api     # restart the server before running these again: the last ones lock the admin PIN
npm run test:e2e     # the Pi's browser tests

# The phone app next to it, for the sync tests
node scripts/serve-static.mjs --port 3200 &
E2E_TARGET=sync npm run test:e2e

# The phone app's own tests: stop the Pi build first, since this uses port 3100 too
npm run serve:pages &
E2E_TARGET=standalone npm run test:e2e

# The upgrade's database step
tests/upgrade/test-upgrade-db.sh

# The cloud features, with a local Supabase (Docker): stop the phone app's server above first (port 3100)
npx supabase@2.119.0 start
npx supabase@2.119.0 test db
eval "$(npx supabase@2.119.0 status -o env | grep -E '^(API_URL|PUBLISHABLE_KEY)=')"
NEXT_PUBLIC_CLOUD_URL="$API_URL" NEXT_PUBLIC_CLOUD_KEY="$PUBLISHABLE_KEY" npm run build:pages
npm run serve:pages &
E2E_TARGET=cloud npm run test:e2e
npx supabase@2.119.0 stop
```
- `LED_DEVICE_IP` points the Pi build at the fake LED display the API tests run.
- If the servers are elsewhere, set `API_BASE_URL` (API tests), `E2E_BASE_URL` (browser tests) and `E2E_TIMER_URL`
  (the sync tests' timer).
- `API_ADMIN_PIN` tells the API tests the admin PIN if it isn't `test1234`.
- `PAGES_BASE_PATH` is the path the phone app is built and served under (`/rc-lap-timer` by default, as on GitHub
  Pages).

`node scripts/screenshots.mjs phone` (or `timer`, against the Pi build) retakes the app's screenshots in `images/`
with sample data; see the script for the details.

To change the database schema, edit `prisma/schema.prisma`, run `npx prisma migrate dev --name <change>`, and
commit the new folder under `prisma/migrations/`. `migrate dev` needs a database user that can create databases.


# License
RC Lap Timer is released under the [MIT License](LICENSE).


# Happy Racing! 🏎️
