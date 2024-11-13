# 🏁 RC Lap Timer 🏎️

Traditional transponder-based RC lap timing systems are incredibly expensive and not conducive to backyard or ad-hoc racing. **RC Lap Timer** is a lightweight, free alternative that enables casual RC racing without expensive equipment.

**RC Lap Timer** has two modes of recording laps, UI mode and Motion Detection mode. UI mode works with two people: a driver and a timer. While one person drives, the other records lap times as the car crosses the start/finish line. Motion Detection mode only requires a driver. It uses a camera on your phone, tablet, or laptop to detect when the car passes by, and records a lap time each time the car passes. 

Motion Detection mode is great for single drivers and practice sessions. UI mode allows each timer to time a different driver, and is ideal for situations where you want to have more than one car on the track. UI mode also supports "penalties", Motion Detection mode does not. 

The app supports multiple drivers with multiple cars, making it easy to switch roles and compare performances. With features like session notes, best lap tracking, session comparisons, and comprehensive statistics, **RC Lap Timer** offers a robust solution for casual RC racing. Built with  a responsive design, it works seamlessly on both desktop and mobile devices.

> **NOTE**: This app is designed for casual racing and fun competition. While it's great for backyard racing and practice sessions, it's not intended to replace professional transponder-based timing systems.

![RC Car](https://img.icons8.com/color/48/000000/car.png)

## 📋 Key Features

- **Interactive Lap Timing** ⏱️
  - Manual lap recording with millisecond precision
  - Automatic lap recording via motion detection using a camera on your phone / tablet / laptop 
  - Configurable lap count or unlimited laps
  - Penalty tracking system
  - Real-time current lap display
  - Lap Number, Last Lap Time announcements

- **Multi-Driver Support** 👥
  - Multiple drivers and cars management
  - Individual driver/car combinations
  - Alphabetically sorted driver and car lists

- **Comprehensive Session Management** 📝
  - Detailed session statistics
  - Best and worst lap highlighting
  - Penalty tracking and statistics
  - Session notes for tracking conditions and setup
  - Date range filtering for session history

- **Advanced Analysis** 📊
  - Best laps comparison across sessions
  - Session-to-session comparison with visual graphs
  - Filterable results by driver, car, and date
  - Historical performance tracking

- **Modern UI/UX** 🎨
  - Responsive design for mobile and desktop
  - Tabbed interface for easy navigation
  - Real-time updates across multiple users
  - Clean, intuitive controls

- **Data Management** 💾
  - MySQL database for robust data storage
  - Automatic data persistence
  - Multi-user support


## 🛠️ Tech Stack
- **Framework**: Next.js 14
- **Language**: TypeScript
- **Database**: MySQL
- **Styling**: Tailwind CSS
- **UI Components**: 
  - shadcn/ui components
  - Lucide React icons
  - Recharts for data visualization
- **ORM**: Prisma
- **Version Control**: Git


## 🚀 Installation

### Prerequisites
- Raspberry Pi Zero 2 W
- 16GB or greater class 10 microSD card
- Card imager software, such as Win32 Disk Imager
- A device with WiFi capabilities, a web browser, and a camera
    - This includes Android and Apple tablets and phones, a Windows, Mac, or Linux computer with a webcam or USB camera.

### Setup Instructions
#### This application is designed to run on a Raspbery Pi Zero 2 W. 
#### No other Raspberry Pi models are currently supported!

Running from a Raspberry Pi Zero 2 W allows for the creation of a wi-fi network (rc-lap-timer) that you and all your friends can connect to. Drivers, their cars, timing session results, and configuration settings are all stored in a MySQL database on the Pi.

### RC Lap Timer - Installation Instructions
These instructions will guide you through writing the RC Lap Timer image to a microSD card for use with your Raspberry Pi Zero 2 W.

#### Required Materials
- A microSD card (32GB recommended)
- A computer with a microSD card reader
- The RC Lap Timer image file:
    - [Download from Google Drive](https://drive.google.com/file/d/1OfJgifu01UUm5-NBkiQAxeGV99CQwXfX/view?usp=sharing)
- Raspberry Pi Imager software
    - [Download from RaspberryPi.com](https://www.raspberrypi.com/software/)

#### Windows Instructions
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


#### macOS Instructions
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


#### Linux Instructions
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

##### Using Command Line (Alternative Method)
- Identify your microSD card device name:
```bash
lsblk
```
- Unmount any mounted partitions:
```bash
sudo umount /dev/sdX*
```
    - (Replace sdX with your device name)

- Write the image:
```bash
sudo dd bs=4M if=path/to/rc_lap_timer.img of=/dev/sdX status=progress conv=fsync
```
    - (Replace path/to/rc_lap_timer.img with the actual path and sdX with your device name)
- Wait for the process to complete
- Run sync to ensure all data is written:
```bash
sudo sync
```

#### After Writing the Image
- Safely remove the microSD card from your computer
- Insert the microSD card into your Raspberry Pi Zero 2 W
- Power on your Raspberry Pi Zero 2 W

#### Troubleshooting Tips
- Ensure you select the correct storage device before writing
- If the write process fails, try:
    - Using a different USB port or card reader
    - Reformatting the microSD card
    - Downloading the image file again
    - Using a different microSD card
    - If your computer doesn't recognize the card after writing, this is normal - the card is formatted for Raspberry Pi use

#### Safety Notes
- Double-check the selected device before writing - selecting the wrong device can result in data loss
- Don't remove the microSD card while writing is in progress
- Ensure your computer doesn't go to sleep during the writing process

Once the image has been writted to the card go ahead an boot up the Pi. After a few minutes you should be the `rc-lap-timer` wi-fi network. Connect to it with the password `rclaptimer`. Then open a browser and navigate to:
`https://rc-lap-timer.local`

Accept the certificate warning and proceed to the site.

If that address does not work you can also try:
`https://rc-lap-timer`
`https://192.168.4.1`



## 📊 Usage Guide

1. **Session Configuration 🏁**
- Add drivers and their cars
- Select driver and car for the session
- Choose number of laps or unlimited mode
- Configure any session-specific settings

2. **Recording Laps ⏲️**
- Start timer to begin session
- Record each lap as car crosses line
- Add penalties when needed
- Stop timer to end session

3. **Session Analysis 📈**
- View real-time lap statistics
- Compare lap times across sessions
- Track penalties and best laps
- Add notes about track conditions or setup

4. **Data Management 💾**
- Filter sessions by date range
- View driver/car specific statistics
- Compare performance across sessions
- Manage session notes and data

**📱 Mobile Support**
The application is fully responsive and optimized for mobile devices, featuring:
- Touch-friendly controls
- Responsive layouts
- Mobile-optimized navigation
- Simplified mobile views


## 🛠️ Development & Contributing

Contributions are welcome! Please follow these steps:
- Fork the repository
- Create a feature branch: git checkout -b feature/feature-name
- Commit your changes: git commit -m 'Add some feature'
- Push to the branch: git push origin feature/feature-name
- Submit a pull request


## 📜 License

This project is licensed under the MIT License. See the LICENSE file for details.
🙌 Acknowledgments
Special thanks to:
- The RC car enthusiast community for feedback and testing
- Icons by Icons8
- shadcn/ui for component templates
- Lucide React for icons
- Recharts for visualization components

# Happy Racing! 🏎️