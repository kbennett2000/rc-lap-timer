# RC Lap Timer - Image Creation and Usage Guide

## Table of Contents
1. [Creating the Distribution Image](#1-creating-the-distribution-image)
   - [Prerequisites](#prerequisites)
   - [Preparing the Pi](#preparing-the-pi)
   - [Creating the Image](#creating-the-image)
   - [Shrinking the Image](#shrinking-the-image)
   - [Setting Up First Boot](#setting-up-first-boot)
   - [Packaging for Distribution](#packaging-for-distribution)
   - [Testing](#testing)
2. [Using the RC Lap Timer Image](#2-using-the-rc-lap-timer-image)
   - [System Requirements](#system-requirements)
   - [Installation Steps](#installation-steps)
   - [First Time Setup](#first-time-setup)
   - [Connecting to RC Lap Timer](#connecting-to-rc-lap-timer)
   - [Troubleshooting](#troubleshooting)

## 1. Creating the Distribution Image

### Prerequisites
- Working RC Lap Timer setup on Raspberry Pi Zero 2 W
- Linux computer with sufficient storage space (at least 32GB free)
- USB card reader
- Root/sudo access on your Linux computer

### Preparing the Pi
SSH into your working Raspberry Pi and run these commands:

```bash
# Clean up unnecessary files
sudo apt clean
sudo apt autoremove
sudo rm -rf /var/lib/apt/lists/*
sudo rm -rf /home/pi/.cache/*
sudo rm -rf /tmp/*

# Clear logs
sudo journalctl --rotate
sudo journalctl --vacuum-time=1s

# Clear bash history
history -c
sudo history -c

# Securely clear free space (this might take a while)
sudo dd if=/dev/zero of=/zero.fill bs=1M
sudo rm -f /zero.fill

# Shut down the Pi
sudo shutdown now
```

### Creating the Image
Remove the SD card from the Pi and connect it to your Linux computer.

```bash
# Identify your SD card device (be very careful with this step!)
lsblk

# Create the image (replace sdX with your actual device, e.g., sdb)
sudo dd if=/dev/sdX of=rc-lap-timer.img bs=4M status=progress
```

### Shrinking the Image
```bash
# Install pishrink
wget https://raw.githubusercontent.com/Drewsif/PiShrink/master/pishrink.sh
chmod +x pishrink.sh
sudo mv pishrink.sh /usr/local/bin

# Shrink the image
sudo pishrink.sh -Z rc-lap-timer.img rc-lap-timer-shrunk.img
```

### Setting Up First Boot
Create the first boot script that will run when users boot their Pi:

```bash
# Create the first boot script
sudo nano /usr/local/bin/first-boot-setup.sh
```

Add this content:
```bash
#!/bin/bash

# Check if this is first boot
if [ ! -f /boot/firstboot.txt ]; then
    # Generate new MySQL password only
    NEW_DB_PASS=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 16)
    sudo mysql -e "ALTER USER 'rc_timer_user'@'localhost' IDENTIFIED BY '$NEW_DB_PASS';"
    
    # Update application .env file
    sudo sed -i "s/your_secure_password_here/$NEW_DB_PASS/" /home/pi/rc-lap-timer/.env
    sudo sed -i "s/your_secure_password_here/$NEW_DB_PASS/" /etc/systemd/system/rc-lap-timer.service
    
    # Create credentials file
    cat > /boot/rc-lap-timer-credentials.txt << EOF
RC Lap Timer Connection Details
==============================
WiFi Network: rc-lap-timer
WiFi Password: rclaptimer
Website: http://rc-lap-timer

Keep this file secure as it contains connection details for your RC Lap Timer.
EOF
    
    # Create first boot flag
    touch /boot/firstboot.txt
    
    # Restart services
    sudo systemctl daemon-reload
    sudo systemctl restart rc-lap-timer
fi
```

Make it executable and set it to run at boot:
```bash
sudo chmod +x /usr/local/bin/first-boot-setup.sh

# Add to rc.local
sudo nano /etc/rc.local

# Add before the exit 0 line:
/usr/local/bin/first-boot-setup.sh &
```

### Packaging for Distribution
Create necessary documentation and package the image:

```bash
# Create SHA256 checksum
sha256sum rc-lap-timer-shrunk.img > rc-lap-timer-shrunk.img.sha256

# Create README file for boot partition
cat > README.txt << EOF
RC Lap Timer - Raspberry Pi Image
===============================

Quick Start Guide:
1. Insert the microSD card into a Raspberry Pi Zero 2 W
2. Power on the Pi and wait about 2 minutes for first boot
3. Look for the "rc-lap-timer" WiFi network
4. Connect to the WiFi network using password: rclaptimer
5. Open http://rc-lap-timer in your web browser
6. You're ready to start timing laps!

Note: On first boot, the system will automatically:
- Configure the system for first use
- Generate secure database credentials
- Create a backup credentials file in the boot partition

For more information, visit: https://github.com/kbennett2000/rc-lap-timer

Version: 1.0.0
Release Date: [Date]

Default Connection Details:
WiFi Network: rc-lap-timer
WiFi Password: rclaptimer
Application URL: http://rc-lap-timer
EOF

# Create zip archive
zip rc-lap-timer-v1.0.0.zip rc-lap-timer-shrunk.img rc-lap-timer-shrunk.img.sha256 README.txt
```

### Testing
Before distribution, test the image:

1. Write the shrunk image to a new SD card
2. Boot it in a different Raspberry Pi Zero 2 W
3. Verify that:
   - First boot script runs successfully
   - WiFi network is created
   - Web application is accessible
   - Database functions correctly
   - All features work as expected

## 2. Using the RC Lap Timer Image

### System Requirements
- Raspberry Pi Zero 2 W
- MicroSD Card (16GB or larger)
- 5V 2.5A Micro USB Power Supply

### Installation Steps
1. Download the RC Lap Timer image file
2. Write the image to a microSD card using Raspberry Pi Imager or similar tool:
   - Launch Raspberry Pi Imager
   - Click "Choose OS" → "Use custom" and select the RC Lap Timer image
   - Click "Choose Storage" and select your microSD card
   - Click "Write"
3. Insert the microSD card into your Raspberry Pi Zero 2 W
4. Connect the power supply

### First Time Setup
When you first power on your Raspberry Pi:
1. Wait approximately 2 minutes for the initial setup to complete
2. The Pi will create a WiFi network named "rc-lap-timer"
3. The system will automatically:
   - Configure the WiFi access point
   - Set up the database with secure credentials
   - Start the RC Lap Timer application

### Connecting to RC Lap Timer
1. On your mobile device:
   - Look for the WiFi network named "rc-lap-timer"
   - Connect using the password: `rclaptimer`
2. Open your web browser
3. Navigate to: `http://rc-lap-timer`
4. The RC Lap Timer application will load and be ready for use

### Troubleshooting

If the WiFi network doesn't appear:
1. Wait a full 2 minutes after powering on
2. Check that you're using a Raspberry Pi Zero 2 W
3. Try power cycling the Pi

If you can't access the website:
1. Verify you're connected to the "rc-lap-timer" WiFi network
2. Try accessing using the IP address: `http://192.168.4.1`
3. Power cycle the Pi and try again

For additional support:
- Check the project GitHub repository
- Look for error messages in `/boot/rc-lap-timer-credentials.txt`
- Contact the project maintainers through GitHub

## Release Notes
Version: 1.0.0
- Initial release of RC Lap Timer image
- Preconfigured for Raspberry Pi Zero 2 W
- Automatic setup on first boot
- Fixed WiFi credentials for easy sharing
- Secure database configuration