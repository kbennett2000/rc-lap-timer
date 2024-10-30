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
- Node.js (v16 or higher)
- MySQL Server
- npm or yarn

### Setup Instructions

1. **Clone the repository**:
```bash
   git clone https://github.com/kbennett2000/rc-lap-timer.git
   cd rc-lap-timer
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up MySQL database:**
- Follow the (database setup instructions in database-setup.md)[database-setup.md]
- Create a .env file in the project root with your database configuration:
```env
DATABASE_URL="mysql://rc_timer_user:your_secure_password_here@localhost:3306/rc_lap_timer"
```

4. **Initialize Prisma:**
```bash
npx prisma generate
npx prisma db push
```

6. **Run the development server:**
```bash
npm run dev
```

7. **Use the application:**
- Access the app at http://localhost:3000


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


## 🔧 Troubleshooting

**Common Issues**
**1. Database Connection**
```bash
# Check MySQL service status
sudo systemctl status mysql

# Verify database exists
mysql -u root -p
SHOW DATABASES;
```

**2. Prisma Issues**
```bash
# Reset Prisma
npx prisma generate --force

# Verify schema
npx prisma db push
```

**3. Next.js Build Issues**
```bash
# Clear Next.js cache
rm -rf .next

# Rebuild
npm run build
```

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