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
Make backup of original dhcpcd configuration
```bash
sudo cp /etc/dhcpcd.conf /etc/dhcpcd.conf.backup
```

Edit dhcpcd configuration
```bash
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
sudo apt update && sudo apt upgrade -y
```

Install Node.js 20.x
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Install required packages
```bash
sudo apt install -y git nginx hostapd dnsmasq mariadb-server certbot
```


## 5. Database Setup
Secure MySQL installation (use password1 for password)
```bash
sudo mysql_secure_installation
```

Create database setup script
```bash
cat > create_rc_timer_database.sql << 'EOF'
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

-- Location table with unique name constraint
CREATE TABLE IF NOT EXISTS Location (
    id VARCHAR(191) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS Session (
    id VARCHAR(191) PRIMARY KEY,
    date DATETIME(3) NOT NULL,
    driverId VARCHAR(191) NOT NULL,
    carId VARCHAR(191) NOT NULL,
    locationId VARCHAR(191) NOT NULL,
    driverName VARCHAR(255) NOT NULL,
    carName VARCHAR(255) NOT NULL,
    locationName VARCHAR(255) NOT NULL,
    totalTime INT NOT NULL,
    totalLaps INT NOT NULL,
    notes TEXT,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL,
    FOREIGN KEY (driverId) REFERENCES Driver(id),
    FOREIGN KEY (carId) REFERENCES Car(id),
    FOREIGN KEY (locationId) REFERENCES Location(id),
    INDEX idx_driverId (driverId),
    INDEX idx_carId (carId),
    INDEX idx_locationId (locationId)
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
    framesToSkip INT NOT NULL DEFAULT 10,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL
);

ALTER DATABASE rc_lap_timer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EOF
```

Run the database setup script
```bash
sudo mysql < create_rc_timer_database.sql
```

## 6. Application Installation
On your Ubuntu Desktop:
Clone the repository
```bash
git clone https://github.com/kbennett2000/rc-lap-timer.git
```

```bash
cd rc-lap-timer
```

Install dependencies
```bash
npm install
```

Create production build
```bash
npm run build
```

After the build completes successfully, create a tar archive of the necessary files:
```bash
tar -czf rc-lap-timer-build.tar.gz * .next package.json package-lock.json node_modules public
```

Transfer the archive to your Raspberry Pi Zero W:
From your Ubuntu Desktop
```bash
scp rc-lap-timer-build.tar.gz pi@raspberrypi.local:~
```

On the Raspberry Pi Zero W:
```bash
cd ~
```

Create new directory
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

Create web root directory and copy files
```bash
sudo mkdir -p /var/www/rc-lap-timer
```

```bash
sudo cp -r .next/* /var/www/rc-lap-timer/
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

Configure hostapd
```bash
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

Very important: Enable and unmask hostapd properly:
```bash
sudo systemctl unmask hostapd
```

```bash
sudo systemctl enable hostapd
```

Configure hostapd to use this config
```bash
sudo sed -i 's#^#DAEMON_CONF="/etc/hostapd/hostapd.conf"#' /etc/default/hostapd
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
Generate SSL certificate
```bash
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
-keyout /etc/ssl/private/rc-lap-timer.key \
-out /etc/ssl/certs/rc-lap-timer.crt \
-subj "/CN=rc-lap-timer/O=RC Lap Timer/C=US"
```

Set proper permissions on the SSL files:
```bash
sudo chmod 600 /etc/ssl/private/rc-lap-timer.key
```

```bash
sudo chmod 644 /etc/ssl/certs/rc-lap-timer.crt
```

### Configure Web Server
```bash
sudo nano /etc/nginx/sites-available/rc-lap-timer
```

Add to nginx configuration:
```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    
    # Redirect all HTTP traffic to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name _;

    ssl_certificate /etc/ssl/certs/rc-lap-timer.crt;
    ssl_certificate_key /etc/ssl/private/rc-lap-timer.key;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
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
npx prisma generate
```

```bash
npx prisma db push
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

Reboot:
```bash
sudo reboot now
```

SEE https://claude.ai/chat/fdab882d-5f3b-4765-9b32-385023ce77ba


## 10. Testing
1. Power cycle the Raspberry Pi
2. Look for the "rc-lap-timer" WiFi network on your mobile device
3. Connect using password: "rclaptimer"
4. Open a web browser and navigate to: `https://rc-lap-timer`
5. Accept the self-signed certificate warning in your browser
