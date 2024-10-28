# RC Lap Timer - Complete Setup Guide

## Table of Contents
1. [Hardware Requirements](#1-hardware-requirements)
2. [Initial SD Card Setup](#2-initial-sd-card-setup)
3. [First Boot Configuration](#3-first-boot-configuration)
4. [Software Installation](#4-software-installation)
5. [Database Setup](#5-database-setup)
6. [Application Installation](#6-application-installation)
7. [Network Configuration](#7-network-configuration)
8. [Service Configuration](#8-service-configuration)
9. [Testing](#9-testing)
10. [Maintenance & Troubleshooting](#10-maintenance--troubleshooting)

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
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 16.x
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install required packages
sudo apt install -y git nginx hostapd dnsmasq mysql-server

# Verify installations
node --version  # Should show v16.x.x
npm --version
mysql --version
```

## 5. Database Setup
```bash
# Secure MySQL installation
sudo mysql_secure_installation

# Create database setup script
cat > create_rc_timer_database.sql << 'EOF'
-- Create database
CREATE DATABASE IF NOT EXISTS rc_lap_timer;
USE rc_lap_timer;
-- Create user and grant privileges (change password as needed)
CREATE USER IF NOT EXISTS 'rc_timer_user'@'localhost' IDENTIFIED BY 'your_secure_password_here';
GRANT ALL PRIVILEGES ON rc_lap_timer.* TO 'rc_timer_user'@'localhost';
FLUSH PRIVILEGES;
-- Driver table
CREATE TABLE IF NOT EXISTS Driver (
    id VARCHAR(191) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL
);
-- Car table
CREATE TABLE IF NOT EXISTS Car (
    id VARCHAR(191) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    driverId VARCHAR(191) NOT NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL,
    FOREIGN KEY (driverId) REFERENCES Driver(id),
    INDEX idx_driverId (driverId)
);
-- Session table
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
-- Lap table
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
-- Penalty table
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
-- Set character set and collation
ALTER DATABASE rc_lap_timer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EOF

# Run the database setup script
sudo mysql < create_rc_timer_database.sql
```

## 6. Application Installation
```bash
# Clone the repository
cd ~
git clone https://github.com/kbennett2000/rc-lap-timer.git
cd rc-lap-timer

# Create .env file
cat > .env << EOF
DATABASE_URL="mysql://rc_timer_user:your_secure_password_here@localhost:3306/rc_lap_timer"
EOF

# Install dependencies and generate Prisma client
npm install
npx prisma generate
npx prisma db push

# Build for production
npm run build

# Create web root directory and copy files
sudo mkdir -p /var/www/rc-lap-timer
sudo cp -r build/* /var/www/rc-lap-timer/
```

## 7. Network Configuration

### Configure WiFi Access Point
```bash
# Stop services initially
sudo systemctl stop hostapd
sudo systemctl stop dnsmasq

# Configure hostapd
sudo nano /etc/hostapd/hostapd.conf
```

Add to hostapd.conf:
```
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
```

```bash
# Configure hostapd to use this config
sudo sed -i 's#^#DAEMON_CONF="/etc/hostapd/hostapd.conf"#' /etc/default/hostapd

# Configure dnsmasq
sudo mv /etc/dnsmasq.conf /etc/dnsmasq.conf.orig
sudo nano /etc/dnsmasq.conf
```

Add to dnsmasq.conf:
```
interface=wlan0
dhcp-range=192.168.4.2,192.168.4.20,255.255.255.0,24h
address=/rc-lap-timer/192.168.4.1
```

Configure network interface:
```bash
sudo nano /etc/network/interfaces
```

Add to interfaces:
```
auto lo
iface lo inet loopback

auto wlan0
iface wlan0 inet static
    address 192.168.4.1
    netmask 255.255.255.0
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
    server_name rc-lap-timer;
    root /var/www/rc-lap-timer;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/rc-lap-timer /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
```

## 8. Service Configuration
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
WorkingDirectory=/home/pi/rc-lap-timer
ExecStart=/usr/bin/npm run dev
Restart=always
Environment=NODE_ENV=production
Environment=DATABASE_URL="mysql://rc_timer_user:your_secure_password_here@localhost:3306/rc_lap_timer"

[Install]
WantedBy=multi-user.target
```

Enable and start all services:
```bash
sudo systemctl enable mysql hostapd dnsmasq rc-lap-timer nginx
sudo systemctl start mysql hostapd dnsmasq rc-lap-timer nginx
```

## 9. Testing
1. Power cycle the Raspberry Pi
2. Look for the "rc-lap-timer" WiFi network on your mobile device
3. Connect using password: "rclaptimer"
4. Open a web browser and navigate to: `http://rc-lap-timer`

## 10. Maintenance & Troubleshooting

### Database Backup
```bash
# Create backup directory
mkdir -p ~/backups

# Backup database
mysqldump -u rc_timer_user -p rc_lap_timer > ~/backups/rc_lap_timer_$(date +%Y%m%d).sql
```

### Common Issues and Solutions

1. If WiFi network doesn't appear:
```bash
sudo systemctl status hostapd
sudo journalctl -u hostapd -f
```

2. If web application doesn't load:
```bash
sudo systemctl status nginx
sudo systemctl status rc-lap-timer
sudo journalctl -u rc-lap-timer -f
```

3. If database issues occur:
```bash
sudo systemctl status mysql
sudo journalctl -u mysql -f
cd ~/rc-lap-timer
npx prisma db push
```

4. To update the application:
```bash
cd ~/rc-lap-timer
git pull
npm install
npm run build
sudo cp -r build/* /var/www/rc-lap-timer/
sudo systemctl restart rc-lap-timer
```

### Important Notes
- Replace `your_secure_password_here` with a strong password wherever it appears
- The default WiFi password is "rclaptimer" - consider changing it