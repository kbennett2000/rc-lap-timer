
# 🏁 RC Lap Timer 🏎️

Traditional transponder-based RC lap timing systems are incredibly expensive and not conducive to backyard or ad-hoc racing. I created **RC Lap Timer** to be a lightweight, free alternative that's almost as good as an expensive system.

In it's current form, **RC Lap Timer** requires two people, a driver and a timer. The driver drives, the timer records a lap time each time the driver's car crosses the start/finish line. The app supports multiple drivers, with multiple cars, so the driver and timer can switch places back and forth.

**RC Lap Timer** contains tools highlighting your best lap time each session, comparing sessions between drivers, and the ability to automatically store and load your driver, car, and lap session data automatically! Designed with modern web technologies, it offers a sleek, intuitive interface for both desktop and mobile users.

NOTE - If you want super-accurate lap times, this isn't the app for you. If you want a fun lap timing system for free for racing around your backyard, park, house, or anywhere else with a few of your RC pals, this is the app for you!

![RC Car](https://img.icons8.com/color/48/000000/car.png)

---

## 📋 Features

- **Highish-Precision Lap Timing** ⏱️: Accurate lap time tracking down to however accurate your clicking is!
- **Multi-Driver Support** 👥: Seamlessly switch between multiple drivers and vehicles.
- **Session History** 📝: Track and review past sessions with detailed statistics.
- **Local Data Persistence** 💾: Store session data locally, and export/import data when needed.
- **Modern UI/UX** 🎨: Built with **Radix UI** and **Lucide React** icons, providing a clean and dynamic interface.
- **Responsive Design** 📱: Optimized for both desktop and mobile devices.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/)
- **Languages**: TypeScript, JavaScript
- **Styling**: Tailwind CSS
- **UI Libraries**: Radix UI, Lucide React icons
- **Data Mangement**: MySQL 
- **Version Control**: Git

---

## 🚀 Installation

Follow these steps to run the project locally:

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Setup Instructions
1. **Clone the repository**:
   ```bash
   git clone https://github.com/kbennett2000/rc-lap-timer.git
   cd rc-lap-timer
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser to view the app.

4. **Build for production**:
   ```bash
   npm run build
   ```

---

## 📊 Usage

### 1. **Start a New Session** 🏁
   - Add drivers and cars in the Session Configuration section.
   - Select the driver and car that will by driving this session.
   - Select the number of laps for this session, or choose Unlimited to run as many laps as you like.
   - Press "Start Lap Timer" to begin the session and automatically log lap times.
   - If you want to end a session early (example - car breaks down and can't finish), or if you're running an Unlimited session and want to record your final lap time, simply click the "Stop Lap Timer" button.

### 2. **Track Laps and Times** ⏲️
   - As the RC car completes laps, lap times are recorded and displayed in real-time.
   - Use the session dashboard to view laps for each driver.

### 3. **Review Session History** 🕒
   - View past session results with detailed timing for each lap and driver.
   - Sessions are stored locally, and you can export the data for backup.

---

## 🛠️ Development & Contributing

Contributions are welcome! To contribute:

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/feature-name`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/feature-name`
5. Submit a pull request.

---

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## 💡 Future Improvements

See the [To Do List](ToDoItems.md) file.

---

## 🙌 Acknowledgments

Special thanks to the RC car enthusiast community for inspiration and feedback during development. Icons by [Icons8](https://icons8.com).

---

### Happy Racing! 🏎️