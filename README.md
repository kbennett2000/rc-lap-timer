# 🏁 RC Lap Timer 🏎️

NOTE - Infrared beacon lap timing in beta stages. More info to come, stay tuned!

Looking for a free, easy to use lap timing system for backyard, parking lot, or garage RC racing? I created **RC Lap Timer** just for you! Transponder-based RC lap timing systems can be expensive and don't always work well with temporary tracks. **RC Lap Timer** is a lightweight, free alternative that enables casual RC racing without expensive equipment.

**RC Lap Timer** has two modes of recording laps, UI mode and Motion Detection mode. UI mode works with two people: a driver and a timer. While one person drives, the other records lap times as the car crosses the start/finish line. Motion Detection mode only requires a driver. It uses a camera on your phone, tablet, or laptop to detect when the car passes by, and records a lap time each time the car passes. 

Motion Detection mode is great for single drivers and practice sessions. UI mode allows each timer to time a different driver, and is ideal for situations where you want to have more than one car on the track. UI mode also supports "penalties", Motion Detection mode does not. 

> **NOTE**: This app is designed for casual racing and fun competition. While it's great for backyard racing and practice sessions, it's not intended to replace professional transponder-based timing systems.

![RC Car](https://img.icons8.com/color/48/000000/car.png)

# 📱 Quick start: just your phone

You don't need a Raspberry Pi to use RC Lap Timer. Open **https://kbennett2000.github.io/rc-lap-timer/** on your phone and add it to your home screen:

- **iPhone or iPad:** open the link in Safari, tap **Share**, then **Add to Home Screen**. Do this *before* you record sessions: the Home Screen app keeps its own data, separate from Safari's.
- **Android:** open the link in Chrome and tap **Install app** in Manager → Data (or use Chrome's menu: **Install app** or **Add to Home screen**).

The phone app times laps with taps (UI mode) or with the camera (Motion Detection mode), and once it's installed it works without an internet connection. Everything you record is stored **on your phone only**. Save a backup from **Manager → Data** every so often: you can restore it if something goes wrong, or use it to move your data to another phone. If you also have an RC Lap Timer box (the Raspberry Pi below), **Sync with the timer** in the same place shares everything both ways while the phone is on the timer's Wi-Fi.

Race mode and infrared (IR) timing need the Raspberry Pi setup below.

# Feature Overview

Watch this short video to understand how RC Lap Timer works and some of the features available. If you like what you see, follow the instructions below to get started!

[![YouTube Application Overview Video](http://img.youtube.com/vi/lfPLHotND4M/0.jpg)](http://www.youtube.com/watch?v=lfPLHotND4M "RC Lap Timer Overview")


# 🚀 Raspberry Pi setup (advanced)

**The Raspberry Pi version is designed to run on a Raspberry Pi Zero 2 W.**

**No other Raspberry Pi models are currently supported!**

Running from a Raspberry Pi Zero 2 W allows for the creation of a wi-fi network (`rc-lap-timer`) that you and all your friends can connect to. Drivers, their cars, timing session results, and configuration settings are all stored in a MySQL database on the Pi.
These instructions will guide you through writing the RC Lap Timer image to a microSD card for use with your Raspberry Pi Zero 2 W.


## Required Materials
- Raspberry Pi Zero 2 W
- 16GB or greater class 10 microSD card
- A device with WiFi capabilities, a web browser, and a camera
    - This includes Android and Apple tablets and phones, a Windows, Mac, or Linux computer with a webcam or USB camera.
- A computer with a microSD card reader
- The RC Lap Timer image file:
    - [Download from Google Drive](https://drive.google.com/file/d/1fJDJici0xtzP4xVhj4DvLpkFYnxi1WDa/view?usp=sharing)
- Raspberry Pi Imager software
    - [https://www.raspberrypi.com/software/](https://www.raspberrypi.com/software/)


## Optional but Helpful Materials
- Mobile phone tripod
- Raspberry Pi Zero case
- Screen Alive (if using Android)


## Windows Instructions
- Download and install Raspberry Pi Imager
- Insert your microSD card into your computer
- Launch Raspberry Pi Imager
- Click "Choose OS"
- Select "Use custom" at the bottom of the list
- Navigate to and select the downloaded RC Lap Timer image file
- Click "Choose Storage" and select your microSD card
- Click "Write" and confirm when prompted
- Wait for the writing and verification process to complete
- Remove the microSD card when prompted


## macOS Instructions
- Download and install Raspberry Pi Imager
- Insert your microSD card into your computer
- Launch Raspberry Pi Imager
- Click "Choose OS"
- Select "Use custom" at the bottom of the list
- Navigate to and select the downloaded RC Lap Timer image file
- Click "Choose Storage" and select your microSD card
- Click "Write" and enter your administrator password when prompted
- Wait for the writing and verification process to complete
- Remove the microSD card when prompted


## Linux Instructions
- Install Raspberry Pi Imager:
Ubuntu/Debian: 
```bash
sudo apt install rpi-imager
```
Fedora: 
```bash
sudo dnf install rpi-imager
```
- Insert your microSD card into your computer
- Launch Raspberry Pi Imager
- Click "Choose OS"
- Select "Use custom" at the bottom of the list
- Navigate to and select the downloaded RC Lap Timer image file
- Click "Choose Storage" and select your microSD card
- Click "Write" and enter your administrator password if prompted
- Wait for the writing and verification process to complete
- Remove the microSD card when prompted


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
  1. In Safari, open `192.168.4.1/rc-lap-timer-ca.crt` and tap **Allow**.
  2. Open Settings, tap **Profile Downloaded**, then **Install**.
  3. In Settings → General → About → **Certificate Trust Settings**, turn on **RC Lap Timer**.
- **Android:** open `192.168.4.1/rc-lap-timer-ca.crt` in Chrome to download it, then in Settings search for
  **CA certificate** and install the downloaded file.

The certificate authority can only vouch for this timer: its key is deleted as soon as it has signed the timer's
certificate. A timer makes a new certificate about every two years (and once when it's upgraded from the old SD
image); install the new one then.



# 📊 Usage Guide
## Adding Drivers, Cars, and Locations
Before running any timing sessions you will need to create at least one driver, create at least one car for that driver, and create at least one timing session location.
- Begin by adding one or more drivers using the 'New Driver' option. Each driver name should be unique. You can change the name of a driver after creation using the Configuration tab. 
- Once you've added one or more drivers, add one or more cars for that driver using the 'New Car' option. Each car name should be unique for that driver. Different drivers can have the same car name. You can change the name of a car after creation using the Configuration tab. 
- Finally, add at least one location using the 'New Location' option. Each location name should be unique. You can change the name of a location after creation using the Configuration tab. 


## Timing a Session
Once you've created a driver, a car for that driver, and a location you can record a timing session. Begin by configuring the new timing session.

## Configuring a Timing Session
### Announcements
![selecting announcement options](/images/announcements.jpg)

When configuring a new timing session can choose to enable lap announcements and lap beeps. 
- **Announce Lap Numbers**: The current lap number will be announced once a new lap is started.
- **Announce Last Lap Time**: The time for the last lap will be announced once a new lap is started.
- **Play Beeps**: Beeps will be played at the start of a session, each time a lap is recorded, when the session completes, and also when motion is detected in motion detection preview mode (see the Motion Detect Timing Mode section for more information)


### Enabling Remote Control
![selecting remote control mode](/images/remoteControlSelection.jpg)

If you're driving by yourself remote control can be a handy option. This option allows you to setup your camera device (phone, tablet, laptop, etc) to be used with motion detection timing. Then, from another device on the same network you can submit a timing session request. Each request contains a driver, a car, a location, and a number of laps. Once the 'Enable Remote Control' option is selected the camera device will listen for any timing session requests. When a timing session request is received the camera will be enabled and a new motion detection timing session will start. This prevents the driver from having to walk out to the camera device and back each time they want to start a new session.

It is important to ensure your camera device is properly placed and configured before using this option!

**NOTE** - If you're using a phone or mobile device as a camera recording device you want to make sure the screen does not timeout / lock during a session. Apps such as 'Screen Alive' for Android can be helpful as they prevent your device from timing out, turning off, or locking for extended periods of time.


### Driver, Car, Location, Number of Laps
![selecting driver car location number of laps](/images/driverCarLocationLaps.jpg)

Once you've selected the timing mode you want to use for the current session, select the driver being timed, their car, the location, and the number of laps being timed. Selecting an Unlimited number of laps will require the driver or an observer to manually end the timing session. Selecting a fixed number of laps will cause the session to end automatically once the last lap has been recorded.


### Timing Mode
![selecting the timing mode](/images/timingModeSelection.jpg)

The application supports two different timing modes, UI mode and Motion Detect mode. 
- UI mode requires two people, a driver and a timer. 
- The timer will use the application's user interface (UI) to begin the session, record each lap when the car being timed crosses the timing point, assign a lap penalty, and end the timing session. 
- UI mode is the only mode that can support multiple cars on the track at the same time as each timer will only record laps for the car they're timing.
- Selecting the timing mode will determine the controls that are displayed below the Driver, Car, Location, and Number of Laps selections.


![ui mode controls](/images/uiControls.jpg)

Selecting the **Time Using UI** option displays four buttons:
- **Start Lap Timer**: Click this button to start the timing session
- **Record Lap**: Once a session has started, the timer will click this button everytime the car their timing crosses the timing point.
- **Stop Lap Timer**: Click this button to stop the current session once the car crosses the timing point for the final time.
- **Add Penalty**: Adds a penalty to the current lap. Penalties can be whatever you want them to be (driver crashes, leaves their lane, reverses on the track, etc). Penalties for each lap and the total number of penalties for the session are saved with the session statistics.


Selecting the **Time Using Motion Detection** option will enable motion detection mode. 
- This mode can be used by a single user as it relies on the device's camera to detect when the car has passed through the frame.
- Selecting the 'Time Using Motion Detection' option displays camera controls and motion detection settings.
**NOTE** - Lap penalties cannot be added in Motion Detection mode!

**NOTE** - The first time you use camera mode you may get a confirmation message. Select the option to allow use of your device's camera.

![camera permissions warning](/images/cameraPermissions.jpg)


#### Camera Controls:
![camera controls](/images/cameraControls.jpg)

- **Preview**: Preview turns on the camera and uses the motion detection settings the user has set or loaded. Preview mode is used to test motion detection without recording a timing session. To use preview mode, begin by selecting the 'Play Beeps' option under the Annoucements section. This will play a beep each time motion is detected. You should also consider temporarily setting the Cooldown time setting low to enable more frequent detections while testing. Use preview mode to test where you setup your device, and run a few practice laps to ensure your car is being detected by the device camera each time it passes by.
- **Cam On**: Once you're ready to start your timing session click this button to turn the camera on. Once the camera is on and the number of frames to skip has passed the camera will start looking for motion. The first time motion is detected (car drives by) the timing session will begin. 
- **Cam Off**: This button turns the camera off and ends the current timing session. Use this button to end a timing session with an 'Unlimited' number of laps, or to end a session with a pre-defined number of laps early.


#### Motion Detection Settings:
**NOTE** - If you change any of these settings while the device camera is on, you MUST stop and restart it for the new settings to take effect.
- **Sensitivity**: Sets the level of sensitivity for motion detection. Increase the sensitity if your car has trouble being detected, lower the sensititivy to reduce the risk of false lap detections.
- **Threshold**: Threshold determines the percentage of the image frame that must change for motion to be recorded. If your car passes the timing point father from the camera you might need a lower Threshold value. Typically values from 0.5% to 5% work well.
- **Cooldown**: Specifies the amount of time (in milliseconds) to wait before trying to detect motion again. This setting is helpful for reducing false detections. Try running a few laps to get a baseline idea of your lap time, then select a Cooldown time that you feel confident is faster than you will be able to run a lap. For example, if a lap takes you roughly 15 seconds, try a cooldown period of 10000 to 12000 (10 to 12 seconds). 
- **Frames to Skip**: The number of frames to skip or ignore once the camera is turned on. Setting a high value prevents any camera shake that might occur from touching the device when turning the camera on from being counted as a lap. If you encounter issues with laps being recorded as soon as the camera comes on, try increasing this value.
- **Save / Load Settings**: If you wish to save your current motion detection settings for later use you can use the Save option. Use the Load Settings option to load a previously saved set of motion detection settings.


## Recent Sessions
![recent sessions](/images/recentSessions.jpg)

The three most recent sessions can be viewed at the bottom of the Current Session tab. You'll see flags incating the Fastest Lap, the Slowest Lap, and the Lap with the most penalties.
If you wish to delete a recent session, use the Delete icon and confirm the deletion.


## Navigation Tabs
![bottom navigation](/images/navigation.jpg)

The tabs at the bottom of the screen can be used to navigate to different areas of the application. We've already looked at the Current Session tab, the rest are detailed below.


## Session Management
### Current Session Stats
![current session tab](/images/currentSession.jpg)

- View statistics from the current timing session. 


### Session Request Form
![requesting a session](/images/requestASession.jpg)

- Request a timing session from the remote device. Select a driver, car, location, and number of laps to be timed.


### Previous Sessions
![previous sessions](/images/previousSessions.jpg)

- View and filter previous timing session statistics
- Delete unwanted sessions


## Best Laps Comparison
![best laps comparison tab](/images/bestLapsComparison.jpg)

- See the fastest lap from each session, ranked from fastest to slowest


## Session Comparison
![session comparison tab](/images/sessionCompare.jpg)

- Create a line chart comparison of different timing sessions. Compare different sessions across drivers, cars, and loctions!


## Session Notes
![session notes tab](/images/sessionNotes.jpg)

- Keep and edit notes for each session. Great for tracking tuning changes, track conditions, setup notes, and more!


## Application Configuration
![application configuration tab](/images/appConfig.jpg)

Use this tab to perform the following administrative functions:
- Add, rename, and delete Drivers
- Add, rename, and delete Cars
- Add, rename, and delete Locations
- Rename, and delete Motion Detection Settings
- Save a backup of everything on the timer, and restore one (**Data**). The backup file is the same as the phone
  app's, so it also moves data between the timer and the phone app: records with the same name become one.
- Change the device name
- Change the Pi user password

Changing system settings requires the admin PIN set on the Pi (see [Pi setup](docs/raspberryPiSetup.md)).


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

The Pi's API routes are the `src/app/api/**/route.pi.ts` files: only the Pi build treats `.pi.ts` files as pages and
routes (see `next.config.js`), so the static build leaves them out.

Screens read and change data only through the `DataStore` in [src/data/types.ts](src/data/types.ts).
[tests/datastore/conformance.ts](tests/datastore/conformance.ts) lists the rules every store follows, as tests.

## Checks
CI runs all of these on every pull request:
- `npm run format:check` (fix with `npm run format`), `npm run lint`, `npm run typecheck`
- `npm test`: unit tests
- `npm run test:api` and `npm run test:e2e`: API and browser tests against a running server and database.
  [tests/api/api.test.ts](tests/api/api.test.ts) shows how to start both. For the phone-only app, run
  `npm run build:pages`, start `npm run serve:pages`, then `E2E_TARGET=standalone npm run test:e2e`.

To change the database schema, edit `prisma/schema.prisma`, run `npx prisma migrate dev --name <change>`, and
commit the new folder under `prisma/migrations/`. `migrate dev` needs a database user that can create databases.


# License
RC Lap Timer is released under the [MIT License](LICENSE).


# Happy Racing! 🏎️
