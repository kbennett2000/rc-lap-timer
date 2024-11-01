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
11. [Maintenance & Troubleshooting](#11-maintenance--troubleshooting)

## 1. Hardware Requirements
- Raspberry Pi Zero 2 W
- SanDisk 32GB Ultra microSDHC UHS-I card
- Micro USB power supply (5V, 2.5A recommended)
- MicroSD card adapter (for initial flashing)

## 2. Initial SD Card Setup
1. Download the latest Raspberry Pi OS Lite (64-bit) from [Raspberry Pi's website](https://www.raspberrypi.com/software/operating-systems/)
2. Download and install the Raspberry Pi Imager
3. Insert the microSD card into your computer
4. Launch Raspberry Pi Imager
5. Click "Choose OS" → "Raspberry Pi OS (other)" → "Raspberry Pi OS Lite (64-bit)"
6. Click "Choose Storage" and select your microSD card
7. Click the gear icon (⚙️) to access advanced options:
   - Enable SSH
   - Set username: pi
   - Set a password
   - Configure wireless LAN (for initial setup only)
   - Set locale settings
8. Click "Save" then "Write"

## 3. First Boot Configuration
1. Insert the microSD card into the Raspberry Pi Zero 2 W
2. Connect power
3. Wait 2-3 minutes for first boot
4. Find the Pi's IP address from your router or use `ping raspberrypi.local`
5. SSH into the Pi: `ssh pi@<IP_ADDRESS>`

## 4. Software Installation

After first boot and SSH'ing in, before making any other changes, modify the network configuration properly:
```bash
# Make backup of original dhcpcd configuration
sudo cp /etc/dhcpcd.conf /etc/dhcpcd.conf.backup
```

```bash
# Edit dhcpcd configuration
sudo nano /etc/dhcpcd.conf
```

Add these lines at the end of dhcpcd.conf:
```
    interface wlan0
    static ip_address=192.168.4.1/24
    nohook wpa_supplicant
```

Next, update the system:
```bash
# Update system
sudo apt update && sudo apt upgrade -y
```

```bash
# Install Node.js 16.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

```bash
# Install required packages
sudo apt install -y git nginx hostapd dnsmasq mariadb-server certbot
```

```bash
# Verify installations
node --version  # Should show v16.x.x
npm --version
mysql --version
```

## 5. Database Setup
```bash
# Secure MySQL installation (use password1 for password)
sudo mysql_secure_installation
```

```bash
# Create database setup script
cat > create_rc_timer_database.sql << 'EOF'
-- Create database
CREATE DATABASE IF NOT EXISTS rc_lap_timer;
USE rc_lap_timer;

CREATE USER IF NOT EXISTS 'rc_timer_user'@'localhost' IDENTIFIED BY 'your_secure_password_here';
GRANT ALL PRIVILEGES ON rc_lap_timer.* TO 'rc_timer_user'@'localhost';
FLUSH PRIVILEGES;

-- Driver table with unique name constraint
CREATE TABLE IF NOT EXISTS Driver (
    id VARCHAR(191) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL
);

-- Car table with unique constraint on driverId+name
CREATE TABLE IF NOT EXISTS Car (
    id VARCHAR(191) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    driverId VARCHAR(191) NOT NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL,
    FOREIGN KEY (driverId) REFERENCES Driver(id),
    UNIQUE KEY unique_driver_car (driverId, name)
);

CREATE TABLE IF NOT EXISTS Session (
    id VARCHAR(191) PRIMARY KEY,
    date DATETIME(3) NOT NULL,
    driverId VARCHAR(191) NOT NULL,
    carId VARCHAR(191) NOT NULL,
    driverName VARCHAR(255) NOT NULL,
    carName VARCHAR(255) NOT NULL,
    totalTime INT NOT NULL,
    totalLaps INT NOT NULL,
    notes TEXT,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL,
    FOREIGN KEY (driverId) REFERENCES Driver(id),
    FOREIGN KEY (carId) REFERENCES Car(id),
    INDEX idx_driverId (driverId),
    INDEX idx_carId (carId)
);

CREATE TABLE IF NOT EXISTS Lap (
    id VARCHAR(191) PRIMARY KEY,
    sessionId VARCHAR(191) NOT NULL,
    lapNumber INT NOT NULL,
    lapTime INT NOT NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL,
    FOREIGN KEY (sessionId) REFERENCES Session(id),
    INDEX idx_sessionId (sessionId)
);

CREATE TABLE IF NOT EXISTS Penalty (
    id VARCHAR(191) PRIMARY KEY,
    sessionId VARCHAR(191) NOT NULL,
    lapNumber INT NOT NULL,
    count INT NOT NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL,
    FOREIGN KEY (sessionId) REFERENCES Session(id),
    INDEX idx_sessionId (sessionId)
);

CREATE TABLE IF NOT EXISTS MotionSettings (
    id VARCHAR(191) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    sensitivity INT NOT NULL,
    threshold FLOAT NOT NULL,
    cooldown INT NOT NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL
);

ALTER DATABASE rc_lap_timer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EOF
```

```bash
# Run the database setup script
sudo mysql < create_rc_timer_database.sql
```

## 6. Application Installation
On your Ubuntu Desktop:
```bash
# Clone the repository
git clone https://github.com/kbennett2000/rc-lap-timer.git
```

```bash
cd rc-lap-timer
```

```bash
# Install dependencies
npm install
```

```bash
# Create production build
npm run build
```

After the build completes successfully, create a tar archive of the necessary files:
```bash
# Create a tar of the required files
tar -czf rc-lap-timer-build.tar.gz * .next package.json package-lock.json node_modules public
```

Transfer the archive to your Raspberry Pi Zero W:
```bash
# From your Ubuntu Desktop
scp rc-lap-timer-build.tar.gz pi@raspberrypi.local:~
```

On the Raspberry Pi Zero W:
```bash
cd ~
```

```bash
# Create new directory
mkdir rc-lap-timer
```

```bash
cd rc-lap-timer
```

```bash
# Extract the build files
tar xzf ../rc-lap-timer-build.tar.gz
```

Create web root directory and copy files
```bash
sudo mkdir -p /var/www/rc-lap-timer
```

```bash
sudo cp -r .next/* /var/www/rc-lap-timer/
```

## 7. Network Configuration

### Configure WiFi Access Point
```bash
# Stop services initially
sudo systemctl stop hostapd
```

```bash
sudo systemctl stop dnsmasq
```

```bash
# Configure hostapd
sudo nano /etc/hostapd/hostapd.conf
```

Add to hostapd.conf:
```
country_code=US  # Replace with your country code
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

```bash
# Very important: Enable and unmask hostapd properly:
sudo systemctl unmask hostapd
```

```bash
sudo systemctl enable hostapd

# Configure hostapd to use this config
sudo sed -i 's#^#DAEMON_CONF="/etc/hostapd/hostapd.conf"#' /etc/default/hostapd
```

```bash
# Configure dnsmasq
sudo mv /etc/dnsmasq.conf /etc/dnsmasq.conf.orig
```

```bash
sudo nano /etc/dnsmasq.conf
```

Add to dnsmasq.conf:
```
interface=wlan0
dhcp-range=192.168.4.2,192.168.4.20,255.255.255.0,24h
domain=wlan
address=/rc-lap-timer/192.168.4.1
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

### Generate Self-Signed Certificate
```bash
# Generate SSL certificate
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
-keyout /etc/ssl/private/rc-lap-timer.key \
-out /etc/ssl/certs/rc-lap-timer.crt
```

### Configure Web Server
```bash
sudo nano /etc/nginx/sites-available/rc-lap-timer
```

Add to nginx configuration:
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name rc-lap-timer;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
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
After=network.target mysql.service

[Service]
Type=simple
User=pi
Group=pi
WorkingDirectory=/home/pi/rc-lap-timer
ExecStart=/usr/bin/node /home/pi/rc-lap-timer/node_modules/.bin/next start -p 3000
Restart=always
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=DATABASE_URL="mysql://rc_timer_user:password1@localhost:3306/rc_lap_timer"

[Install]
WantedBy=multi-user.target
```

Fix the default hostapd configuration:
```bash
sudo nano /etc/default/hostapd
```

Replace everything in that file with just this line (make sure there are no extra spaces or characters):
```
DAEMON_CONF="/etc/hostapd/hostapd.conf"
```

Verify the permissions and ownership:
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
sudo systemctl enable mysql hostapd dnsmasq rc-lap-timer nginx
```
```bash
sudo systemctl start mysql hostapd dnsmasq rc-lap-timer nginx
```

Make sure nginx user (www-data) has access to the directory:
```bash
sudo chown -R www-data:www-data /var/www/rc-lap-timer
```

```bash
sudo chmod -R 755 /var/www/rc-lap-timer
```

Log in to MySQL using sudo:
```bash
sudo mysql
```

In MySQL:
```sql
-- Set root password
ALTER USER 'root'@'localhost' IDENTIFIED BY 'password1';

SET PASSWORD FOR 'root'@'localhost' = PASSWORD('password1');

-- Drop and recreate rc_timer_user
DROP USER IF EXISTS 'rc_timer_user'@'localhost';

CREATE USER 'rc_timer_user'@'localhost' IDENTIFIED BY 'password1';

-- Make sure database exists
CREATE DATABASE IF NOT EXISTS rc_lap_timer;

-- Grant privileges
GRANT ALL PRIVILEGES ON rc_lap_timer.* TO 'rc_timer_user'@'localhost';

FLUSH PRIVILEGES;
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

For the immediate command, you can export the variable:
```bash
export DATABASE_URL="mysql://rc_timer_user:password1@localhost:3306/rc_lap_timer"
```

Now try the Prisma commands:
```bash
# BUG:
# pi@raspberrypi:~/rc-lap-timer $ npx prisma generate
# Illegal instruction
npx prisma generate
```

```bash
npx prisma db push
```

Verify our process user permissions:
```bash
# Check the owner of the rc-lap-timer directory
ls -la /home/pi/rc-lap-timer
```

```bash
# Make sure pi user owns everything
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

```bash
# Wait a few seconds
sudo systemctl start nginx
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
5. Accept the self-signed certificate warning in your browser
