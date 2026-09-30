# RC Lap Timer - Complete Setup Guide

## Table of Contents
1. [Hardware Requirements](#1-hardware-requirements)
2. [Initial SD Card Setup](#2-initial-sd-card-setup)
3. [First Boot Configuration](#3-first-boot-configuration)
4. [Software Installation](#4-software-installation)
5. [Database Setup](#5-database-setup)
6. [Application Installation](#6-application-installation)
7. [Network Configuration](#7-network-configuration)
8. [HTTPS Configuration](#8-https-configuration)
9. [Service Configuration](#9-service-configuration)
10. [Testing](#10-testing)
11. [Upgrades, Backups and Troubleshooting](#11-upgrades-backups-and-troubleshooting)

## Notes
- The quickest way to set up a timer is the SD image in the README. This guide builds one from scratch.
- Setup takes 30-45 minutes and needs an internet connection throughout.
- Connect the Pi to your network by **Ethernet** for the whole setup: step 4 turns its Wi-Fi into the timer's own
  network, which ends any SSH session over Wi-Fi. Ethernet and the timer's Wi-Fi work side by side afterwards.
- ⚠️ This guide hasn't been checked step by step on the current Raspberry Pi OS (bookworm), which manages Wi-Fi with
  NetworkManager. Steps marked ⚠️ are the ones that may need adjusting there.

## 1. Hardware Requirements
- Raspberry Pi Zero 2 W
- SanDisk 32GB Ultra microSDHC UHS-I card
- Micro USB power supply (5V, 2.5A recommended)
- MicroSD card adapter (for initial flashing)
- A USB Ethernet adapter and a micro-USB OTG adapter, for the setup (see Notes)

## 2. Initial SD Card Setup
1. Download the latest Raspberry Pi OS Lite (64-bit) from [Raspberry Pi's website](https://www.raspberrypi.com/software/operating-systems/)
2. Download and install the Raspberry Pi Imager
3. Insert the microSD card into your computer
4. Launch Raspberry Pi Imager
5. **Choose Device**: Raspberry Pi Zero 2 W
6. **Choose OS**: "Raspberry Pi OS (other)" → "Raspberry Pi OS Lite (64-bit)"
7. **Choose Storage**: your microSD card
8. Click **Next**, then **Edit Settings** when asked about OS customisation:
   - Set the hostname: `rclaptimer` (the upgrade scripts and certificates expect this name)
   - Set username `pi` and a password
   - Set the wireless LAN country (the Wi-Fi stays switched off until it's set). You don't need to enter a Wi-Fi
     network: the setup uses Ethernet.
   - Set the locale settings
   - On the Services tab, enable SSH
9. Save, then **Yes** to apply the settings and write the card

## 3. First Boot Configuration
1. Insert the microSD card into the Raspberry Pi Zero 2 W
2. Connect power
3. Wait 2-3 minutes for first boot
4. Find the Pi's IP address from your router or use `ping rclaptimer.local`
5. SSH into the Pi: `ssh pi@rclaptimer.local` (or `ssh pi@<IP_ADDRESS>`)

## 4. Software Installation

First, update the system
```bash
sudo apt update && sudo apt upgrade -y
```

Install Node.js 22.x
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
```

Install required packages
```bash
sudo apt install -y nodejs nginx hostapd dnsmasq mariadb-server dhcpcd5
```

Make backup of original dhcpcd configuration
```bash
sudo cp /etc/dhcpcd.conf /etc/dhcpcd.conf.backup
```

Edit dhcpcd configuration
```bash
sudo nano /etc/dhcpcd.conf
```

Replace the contents with these lines. From here on the Pi's Wi-Fi no longer joins your network (see Notes).
```
    interface wlan0
    static ip_address=192.168.4.1/24
    nohook wpa_supplicant
```

⚠️ On bookworm, NetworkManager manages the Wi-Fi and gets in the way of the timer's network. If the `rc-lap-timer`
network doesn't appear at the end, tell NetworkManager to leave the Wi-Fi alone, then reboot:
```bash
printf '[keyfile]\nunmanaged-devices=interface-name:wlan0\n' | sudo tee /etc/NetworkManager/conf.d/rc-lap-timer.conf
```

Enable and start the service:
```bash
sudo systemctl enable dhcpcd
```
```bash
sudo systemctl start dhcpcd
```


## 5. Database Setup
Secure MySQL installation (use password1 for password). This guide uses `password1` for the database
throughout, as the upgrade does when it has to make a `.env`. If you choose your own, use the same one everywhere:
the `rc_timer_user` account below, `DATABASE_URL` in the app's service file, and `.env`.
```bash
sudo mysql_secure_installation
```

Create database setup script
```bash
cat > create_rc_timer_database.sql << 'EOF'
CREATE DATABASE IF NOT EXISTS rc_lap_timer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'rc_timer_user'@'localhost' IDENTIFIED BY 'password1';
GRANT ALL PRIVILEGES ON rc_lap_timer.* TO 'rc_timer_user'@'localhost';
FLUSH PRIVILEGES;
EOF
```

Run the database setup script
```bash
sudo mysql < create_rc_timer_database.sql
```

Give the database's root user a password. The backup, restore and upgrade scripts log in as root with it:
```bash
sudo mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'password1';"
```

The tables are created later, when you run `npx prisma migrate deploy`.

## 6. Application Installation
On your computer (the build box; this guide uses Ubuntu), with Node 22 and [nvm](https://github.com/nvm-sh/nvm):
Clone the repository
```bash
git clone https://github.com/kbennett2000/rc-lap-timer.git
```

```bash
cd rc-lap-timer
```

Install dependencies
```bash
nvm use && npm ci
```

Create production build
```bash
npm run build
```

After the build completes successfully, create a tar archive of the necessary files (as `serverUpgrade.sh` does:
dotfiles such as `.env`, development certificates and the phone app's `out/` stay behind):
```bash
tar -czf rc-lap-timer-build.tar.gz --exclude='*.pem' --exclude='rc-lap-timer-build.tar.gz' --exclude='out' * .next
```

Transfer the archive to your Raspberry Pi Zero 2 W:
```bash
scp rc-lap-timer-build.tar.gz pi@rclaptimer.local:~
```

On the Raspberry Pi Zero 2 W:
```bash
cd ~
```

Create the directory for database backups
```bash
mkdir db-backups
```

Create new application directory
```bash
mkdir rc-lap-timer
```

```bash
cd rc-lap-timer
```

Extract the build files
```bash
tar xzf ../rc-lap-timer-build.tar.gz
```

## 7. Network Configuration

### Configure WiFi Access Point
Stop services initially
```bash
sudo systemctl stop hostapd
```

```bash
sudo systemctl stop dnsmasq
```

Reset the wireless interface
```bash
sudo ip link set wlan0 down
```
```bash
sudo ip addr flush dev wlan0
```
```bash
sudo ip link set wlan0 up
```

Configure hostapd
```bash
sudo nano /etc/hostapd/hostapd.conf
```

Add to hostapd.conf (with your own country code instead of US):
```
country_code=US
interface=wlan0
driver=nl80211
ssid=rc-lap-timer
hw_mode=g
channel=7
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase=rclaptimer
wpa_key_mgmt=WPA-PSK
wpa_pairwise=TKIP
rsn_pairwise=CCMP
ieee80211n=1
```

Very important: Enable and unmask hostapd properly:
```bash
sudo systemctl unmask hostapd
```

```bash
sudo systemctl enable hostapd
```

Configure hostapd to use this config
```bash
echo 'DAEMON_CONF="/etc/hostapd/hostapd.conf"' | sudo tee /etc/default/hostapd
```

Configure dnsmasq
```bash
sudo mv /etc/dnsmasq.conf /etc/dnsmasq.conf.orig
```

```bash
sudo nano /etc/dnsmasq.conf
```

Add to dnsmasq.conf:
```
interface=wlan0
dhcp-range=192.168.4.2,192.168.4.20,255.255.255.0,24h
domain=local
address=/rc-lap-timer/192.168.4.1
address=/rc-lap-timer.local/192.168.4.1
```

interfaces.d needs to be created:
```bash
sudo mkdir /etc/network/interfaces.d
```

Configure network interface:
```bash
sudo nano /etc/network/interfaces.d/access-point
```

Add to interfaces:
```
auto lo
iface lo inet loopback

auto wlan0
iface wlan0 inet static
    address 192.168.4.1
    netmask 255.255.255.0

allow-hotplug wlan0
iface wlan0 inet static
    address 192.168.4.1
    netmask 255.255.255.0
```

## 8. HTTPS Configuration

### Make the Timer's Certificate
Each timer makes its own certificate, with a small certificate authority phones can install to trust it (see
"Trusting the timer on a phone" in the README). A service makes it at boot whenever it's missing or about to expire:
```bash
sudo install -m 755 ~/rc-lap-timer/scripts/system/rc-tls.sh /usr/local/bin/rc-tls.sh
sudo install -m 644 ~/rc-lap-timer/scripts/system/rc-lap-timer-tls.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable rc-lap-timer-tls.service
sudo rc-tls.sh
```

### Configure Web Server
The web server's settings are in the app: [scripts/system/nginx/rc-lap-timer.conf](../scripts/system/nginx/rc-lap-timer.conf).
They send plain HTTP to HTTPS, except the sync routes the phone app calls, and pass everything else to the app and
the IR detector. Upgrades (`piUpgrade2.sh`) install them again, so make changes in that file rather than on the Pi.
```bash
sudo cp ~/rc-lap-timer/scripts/system/nginx/rc-lap-timer.conf /etc/nginx/sites-available/rc-lap-timer
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/rc-lap-timer /etc/nginx/sites-enabled/
```

```bash
sudo rm /etc/nginx/sites-enabled/default
```

```bash
sudo nginx -t
```

```bash
sudo systemctl restart nginx
```

## 9. Service Configuration
```bash
sudo nano /etc/systemd/system/rc-lap-timer.service
```

Add to rc-lap-timer.service:
```ini
[Unit]
Description=RC Lap Timer Application
After=network.target mariadb.service

[Service]
Type=simple
User=pi
Group=pi
WorkingDirectory=/home/pi/rc-lap-timer
# Listen on localhost only, so nginx (TLS and the hardening above) is the only way in
ExecStart=/usr/bin/node /home/pi/rc-lap-timer/node_modules/.bin/next start -p 3000 -H 127.0.0.1
Restart=always
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=DATABASE_URL="mysql://rc_timer_user:password1@localhost:3306/rc_lap_timer"
# Optional settings such as ADMIN_PIN, SYNC_ALLOWED_ORIGINS and LED_DEVICE_IP (see "System Configuration Feature Setup")
EnvironmentFile=-/etc/rc-lap-timer.env

[Install]
WantedBy=multi-user.target
```

Verify the hostapd configuration's permissions and ownership:
```bash
sudo chown root:root /etc/hostapd/hostapd.conf
```

```bash
sudo chmod 600 /etc/hostapd/hostapd.conf
```

Now try to restart hostapd:
```bash
sudo systemctl restart hostapd
```

Enable and start all services:
```bash
sudo systemctl enable mariadb hostapd dnsmasq rc-lap-timer nginx
```

Start services in order with delays:
```bash
sudo systemctl start mariadb
```
```bash
sleep 2
```
```bash
sudo systemctl start hostapd
```
```bash
sleep 2
```
```bash
sudo systemctl start dnsmasq
```
```bash
sleep 2
```
```bash
sudo systemctl start rc-lap-timer
```
```bash
sleep 2
```
```bash
sudo systemctl start nginx
```


Create a .env file in your rc-lap-timer directory:
```bash
cd /home/pi/rc-lap-timer
```

```bash
nano .env
```

Add this line:
```
DATABASE_URL="mysql://rc_timer_user:password1@localhost:3306/rc_lap_timer"
```

Create the database's tables:
```bash
npx prisma generate
```

```bash
npx prisma migrate deploy
```

Verify our process user permissions:
Check the owner of the rc-lap-timer directory
```bash
ls -la /home/pi/rc-lap-timer
```

Make sure pi user owns everything
```bash
sudo chown -R pi:pi /home/pi/rc-lap-timer
```

Restart everything in order:
```bash
sudo systemctl daemon-reload
```

```bash
sudo systemctl stop rc-lap-timer
```

```bash
sudo systemctl stop nginx
```

```bash
sudo pkill -f next
```

```bash
sudo systemctl start rc-lap-timer
```

Wait a few seconds
```bash
sudo systemctl start nginx
```

### System Configuration Feature Setup

Install the configuration helper from the repository. It validates every value, reads passwords
from stdin, and never passes input through `sed` or a shell:
```bash
sudo install -o root -g root -m 755 ~/rc-lap-timer/scripts/system/rc-config-helper.sh /usr/local/bin/rc-config-helper.sh
```

The System Settings screen is disabled until you set an admin PIN. Create `/etc/rc-lap-timer.env`
(it's outside the app folder, so upgrades don't overwrite it) and restart the app:
```bash
echo 'ADMIN_PIN=ChooseAPin123' | sudo tee /etc/rc-lap-timer.env > /dev/null
sudo chmod 600 /etc/rc-lap-timer.env
sudo systemctl restart rc-lap-timer
```
Use 6-32 letters or numbers. Anyone who knows the PIN can rename the Pi, change the `pi` user's
password and reboot it, so don't share it with guests on the Wi-Fi. Wrong PINs lock System Settings for a
while (longer after each lockout); `sudo systemctl restart rc-lap-timer` clears the lock.

The same file takes two other optional settings, one per line:
- `SYNC_ALLOWED_ORIGINS`: the sites whose phone app may sync with this timer, comma-separated. The default is
  `https://kbennett2000.github.io`; a fork that publishes its own phone app adds its site here.
- `LED_DEVICE_IP`: the Remote LED display's address, if it isn't the default `192.168.4.99`.

Let the app run the helper. Edit the sudoers rule with `visudo`, which refuses a rule with a mistake in it (a broken
sudoers file can lock you out of `sudo`):
```bash
sudo visudo -f /etc/sudoers.d/rc-lap-timer
```

Its content:
```
# Allow pi user to execute configuration helper script without password
pi ALL=(ALL) NOPASSWD: /usr/local/bin/rc-config-helper.sh *
```

The helper also sets the Pi's clock, which needs no PIN. The Pi has no clock battery and no internet, so after being
switched off its clock is behind; the app sets it forward to the time of the first phone or browser that opens it
(once per boot, never backwards, and never during a race). `fake-hwclock` saves that time so it survives a power cut.
Raspberry Pi OS includes it; check with `dpkg -s fake-hwclock`, and install it with `sudo apt install fake-hwclock`
if it's missing.

Copy database files to home directory:
```bash
cp -f ~/rc-lap-timer/scripts/database/clearDB.sql ~/
```

Copy system files to home directory:
```bash
cp -f ~/rc-lap-timer/scripts/system/backupDB.sh ~/
```
```bash
cp -f ~/rc-lap-timer/scripts/system/clearDB.sh ~/
```
```bash
cp -f ~/rc-lap-timer/scripts/system/piUpgrade1.sh ~/
```
```bash
cp -f ~/rc-lap-timer/scripts/system/piUpgrade2.sh ~/
```
```bash
cp -f ~/rc-lap-timer/scripts/system/recreateDB.sh ~/
```
```bash
cp -f ~/rc-lap-timer/scripts/system/restoreDB.sh ~/
```
```bash
cp -f ~/rc-lap-timer/scripts/system/upgrayedd.sh ~/
```

Copy motd file to /etc:
```bash
sudo cp -f ~/rc-lap-timer/misc/etc/motd /etc/motd
```

Make the scripts executable
```bash
cd ~ && sudo chmod +x *.sh
```

Configure Python and components for IR Detection
```bash
sudo apt install -y python3-pip
```
```bash
sudo apt install -y python3-rpi.gpio
```
```bash
pip3 install flask --break-system-packages
```

Create a service file for the IR detector:
```bash
sudo nano /etc/systemd/system/ir-detector.service
```

Add the following content:
```ini
[Unit]
Description=IR Detector Service
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/rc-lap-timer
ExecStart=/usr/bin/python3 IRDetectorService.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl enable ir-detector
```

```bash
sudo systemctl start ir-detector
```

```bash
sudo systemctl restart nginx
```

Reboot:
```bash
sudo reboot now
```


## 10. Testing
1. Power cycle the Raspberry Pi
2. Look for the "rc-lap-timer" WiFi network on your mobile device
3. Connect using password: "rclaptimer"
4. Open a web browser and navigate to: `https://rc-lap-timer`
5. Accept the certificate warning in your browser, or install the timer's certificate so there's no warning (see
   "Trusting the timer on a phone" in the README)

## 11. Upgrades, Backups and Troubleshooting
- **Upgrading:** follow [updateNotes.md](updateNotes.md). It backs up the database first.
- **Backups:** every upgrade saves one in `~/db-backups`; `~/backupDB.sh` makes one at any time, and `~/restoreDB.sh`
  restores the newest (or the one you name). The app's Manager → Data saves and restores backups too.
- **The app's log:** `sudo journalctl -u rc-lap-timer -n 50` (and `-u ir-detector`, `-u nginx`).
- **Restarting the app:** `sudo systemctl restart rc-lap-timer`. That also clears a System Settings PIN lockout.
