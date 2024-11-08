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

-- Create SessionRequest table with ENUM
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

-- Create CurrentSession table
CREATE TABLE IF NOT EXISTS CurrentSession (
  id VARCHAR(191) PRIMARY KEY,
  driverName VARCHAR(255) NOT NULL,
  carName VARCHAR(255) NOT NULL,
  locationName VARCHAR(255) NOT NULL,
  lapCount INT NOT NULL DEFAULT 0,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL
);

-- Create CurrentLap table with cascade delete
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

ALTER DATABASE rc_lap_timer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;