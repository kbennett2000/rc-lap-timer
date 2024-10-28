-- create_rc_timer_database.sql

-- Create database
CREATE DATABASE IF NOT EXISTS rc_lap_timer;
USE rc_lap_timer;

-- Create user and grant privileges (change password as needed)
CREATE USER IF NOT EXISTS 'rc_timer_user'@'localhost' IDENTIFIED BY 'your_secure_password_here';
GRANT ALL PRIVILEGES ON rc_lap_timer.* TO 'rc_timer_user'@'localhost';
FLUSH PRIVILEGES;

-- Create tables
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