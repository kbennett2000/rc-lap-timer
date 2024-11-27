CREATE DATABASE IF NOT EXISTS rc_lap_timer;
USE rc_lap_timer;
CREATE USER IF NOT EXISTS 'rc_timer_user'@'localhost' IDENTIFIED BY 'your_secure_password_here';
GRANT ALL PRIVILEGES ON rc_lap_timer.* TO 'rc_timer_user'@'localhost';
FLUSH PRIVILEGES;

-- Driver table
CREATE TABLE IF NOT EXISTS Driver (
  id VARCHAR(191) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL
);

-- Location table
CREATE TABLE IF NOT EXISTS Location (
  id VARCHAR(191) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL
);

-- Car table
CREATE TABLE IF NOT EXISTS Car (
  id VARCHAR(191) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  driverId VARCHAR(191) NOT NULL,
  defaultCarNumber INT,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL,
  FOREIGN KEY (driverId) REFERENCES Driver(id),
  UNIQUE KEY unique_driver_car (driverId, name)
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
  locationId VARCHAR(191) NOT NULL,
  locationName VARCHAR(255) NOT NULL,
  FOREIGN KEY (driverId) REFERENCES Driver(id),
  FOREIGN KEY (carId) REFERENCES Car(id),
  FOREIGN KEY (locationId) REFERENCES Location(id),
  INDEX idx_driverId (driverId),
  INDEX idx_carId (carId),
  INDEX idx_locationId (locationId)
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

-- MotionSettings table
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

-- SessionRequest table
CREATE TABLE IF NOT EXISTS SessionRequest (
  id VARCHAR(191) PRIMARY KEY,
  driverId VARCHAR(191) NOT NULL,
  carId VARCHAR(191) NOT NULL,
  locationId VARCHAR(191) NOT NULL,
  numberOfLaps INT NOT NULL,
  status ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL,
  FOREIGN KEY (driverId) REFERENCES Driver(id),
  FOREIGN KEY (carId) REFERENCES Car(id),
  FOREIGN KEY (locationId) REFERENCES Location(id),
  INDEX idx_driverId (driverId),
  INDEX idx_carId (carId),
  INDEX idx_locationId (locationId),
  INDEX idx_status (status)
);

-- CurrentSession table
CREATE TABLE IF NOT EXISTS CurrentSession (
  id VARCHAR(191) PRIMARY KEY,
  driverName VARCHAR(255) NOT NULL,
  carName VARCHAR(255) NOT NULL,
  locationName VARCHAR(255) NOT NULL,
  lapCount INT NOT NULL DEFAULT 0,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL
);

-- CurrentLap table
CREATE TABLE IF NOT EXISTS CurrentLap (
  id VARCHAR(191) PRIMARY KEY,
  sessionId VARCHAR(191) NOT NULL,
  lapTime INT NOT NULL,
  lapNumber INT NOT NULL,
  penaltyCount INT NOT NULL DEFAULT 0,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL,
  FOREIGN KEY (sessionId) REFERENCES CurrentSession(id) ON DELETE CASCADE,
  INDEX idx_sessionId (sessionId)
);

-- Race table
CREATE TABLE IF NOT EXISTS Race (
  id VARCHAR(191) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  date DATETIME(3) NOT NULL,
  locationId VARCHAR(191) NOT NULL,
  status ENUM('PENDING', 'COUNTDOWN', 'RACING', 'PAUSED', 'FINISHED', 'STOPPED') NOT NULL DEFAULT 'PENDING',
  startDelay INT NOT NULL,
  totalLaps INT,
  startTime DATETIME(3),
  endTime DATETIME(3),
  notes TEXT,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL,
  FOREIGN KEY (locationId) REFERENCES Location(id),
  INDEX idx_locationId (locationId),
  INDEX idx_status (status)
);

-- RaceEntry table
CREATE TABLE IF NOT EXISTS RaceEntry (
  id VARCHAR(191) PRIMARY KEY,
  raceId VARCHAR(191) NOT NULL,
  driverId VARCHAR(191) NOT NULL,
  carId VARCHAR(191) NOT NULL,
  carNumber INT NOT NULL,
  position INT,
  lapsCompleted INT NOT NULL DEFAULT 0,
  bestLapTime INT,
  totalTime INT,
  status ENUM('REGISTERED', 'RACING', 'FINISHED', 'DNF') NOT NULL DEFAULT 'REGISTERED',
  dnfReason TEXT,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL,
  FOREIGN KEY (raceId) REFERENCES Race(id),
  FOREIGN KEY (driverId) REFERENCES Driver(id),
  FOREIGN KEY (carId) REFERENCES Car(id),
  UNIQUE KEY unique_race_car_number (raceId, carNumber),
  UNIQUE KEY unique_race_driver (raceId, driverId),
  INDEX idx_raceId (raceId),
  INDEX idx_driverId (driverId),
  INDEX idx_carId (carId),
  INDEX idx_status (status)
);

-- RaceLap table
CREATE TABLE IF NOT EXISTS RaceLap (
  id VARCHAR(191) PRIMARY KEY,
  raceEntryId VARCHAR(191) NOT NULL,
  lapNumber INT NOT NULL,
  lapTime INT NOT NULL,
  position INT NOT NULL,
  gap INT NOT NULL,
  timestamp DATETIME(3) NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL,
  FOREIGN KEY (raceEntryId) REFERENCES RaceEntry(id),
  UNIQUE KEY unique_entry_lap (raceEntryId, lapNumber),
  INDEX idx_raceEntryId (raceEntryId)
);

ALTER DATABASE rc_lap_timer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
