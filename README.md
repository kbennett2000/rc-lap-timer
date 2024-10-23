# RC Lap Timer

A web-based lap timing system for RC cars, built with Next.js and TypeScript. This application allows users to record lap times for RC cars, manage multiple drivers and their cars, and maintain a history of racing sessions.

## Features

- ⏱️ Kinda High-precision lap timing
- 👥 Multiple driver support
- 🚗 Multiple car management per driver
- 📊 Session statistics
- 💾 Local storage persistence
- 📤 Export/Import functionality for data backup
- 🔍 Session history with detailed statistics
- 🎯 Confirmation dialogs for important actions

## Tech Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- shadcn/ui components
- Radix UI primitives
- Lucide React icons

## Prerequisites

- Node.js 18.17 or later
- npm or yarn package manager

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/rc-lap-timer.git
cd rc-lap-timer
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Usage

### Adding a Driver
1. Click the "New Driver" button
2. Enter the driver's name
3. Click "Add"

### Adding a Car
1. Select a driver
2. Click the "New Car" button
3. Enter the car's name
4. Click "Add"

### Recording Lap Times
1. Select a driver and car
2. Click "Start Lap Timer"
3. Click "Record Lap" each time the car completes a lap
4. Click "Stop Lap Timer" when the session is complete

### Managing Sessions
- View current and previous session statistics
- Export data for backup
- Import previously exported data
- Delete individual sessions or clear all sessions

## Data Persistence

The application uses localStorage to persist:
- Driver information
- Car information
- Session history

Data can be exported to JSON files for backup and imported when needed.

## Development

### Project Structure
```
rc-lap-timer/
├── src/
│   ├── app/
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   └── ...
│   │   └── rc-timer/
│   │       └── lap-timer.tsx
│   └── lib/
│       └── utils.ts
├── public/
└── package.json
```

### Custom Components
The application uses shadcn/ui components for the UI, which are built on top of Radix UI primitives.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
