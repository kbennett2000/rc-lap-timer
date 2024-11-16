-- Backup script for rc_lap_timer database
-- This will generate INSERT statements for all tables in the correct order to maintain referential integrity

SET FOREIGN_KEY_CHECKS=0;

SELECT 'Backing up Driver table...' as '';
SELECT CONCAT(
    'INSERT INTO Driver (id, name, createdAt, updatedAt) VALUES (',
    QUOTE(id), ', ',
    QUOTE(name), ', ',
    QUOTE(createdAt), ', ',
    QUOTE(updatedAt), ');'
) FROM Driver;

SELECT 'Backing up Location table...' as '';
SELECT CONCAT(
    'INSERT INTO Location (id, name, createdAt, updatedAt) VALUES (',
    QUOTE(id), ', ',
    QUOTE(name), ', ',
    QUOTE(createdAt), ', ',
    QUOTE(updatedAt), ');'
) FROM Location;

SELECT 'Backing up Car table...' as '';
SELECT CONCAT(
    'INSERT INTO Car (id, name, driverId, createdAt, updatedAt) VALUES (',
    QUOTE(id), ', ',
    QUOTE(name), ', ',
    QUOTE(driverId), ', ',
    QUOTE(createdAt), ', ',
    QUOTE(updatedAt), ');'
) FROM Car;

SELECT 'Backing up Session table...' as '';
SELECT CONCAT(
    'INSERT INTO Session (id, date, driverId, carId, locationId, driverName, carName, locationName, totalTime, totalLaps, notes, createdAt, updatedAt) VALUES (',
    QUOTE(id), ', ',
    QUOTE(date), ', ',
    QUOTE(driverId), ', ',
    QUOTE(carId), ', ',
    QUOTE(locationId), ', ',
    QUOTE(driverName), ', ',
    QUOTE(carName), ', ',
    QUOTE(locationName), ', ',
    totalTime, ', ',
    totalLaps, ', ',
    IFNULL(QUOTE(notes), 'NULL'), ', ',
    QUOTE(createdAt), ', ',
    QUOTE(updatedAt), ');'
) FROM Session;

SELECT 'Backing up Lap table...' as '';
SELECT CONCAT(
    'INSERT INTO Lap (id, sessionId, lapNumber, lapTime, createdAt, updatedAt) VALUES (',
    QUOTE(id), ', ',
    QUOTE(sessionId), ', ',
    lapNumber, ', ',
    lapTime, ', ',
    QUOTE(createdAt), ', ',
    QUOTE(updatedAt), ');'
) FROM Lap;

SELECT 'Backing up Penalty table...' as '';
SELECT CONCAT(
    'INSERT INTO Penalty (id, sessionId, lapNumber, count, createdAt, updatedAt) VALUES (',
    QUOTE(id), ', ',
    QUOTE(sessionId), ', ',
    lapNumber, ', ',
    count, ', ',
    QUOTE(createdAt), ', ',
    QUOTE(updatedAt), ');'
) FROM Penalty;

SELECT 'Backing up MotionSettings table...' as '';
SELECT CONCAT(
    'INSERT INTO MotionSettings (id, name, sensitivity, threshold, cooldown, framesToSkip, createdAt, updatedAt) VALUES (',
    QUOTE(id), ', ',
    QUOTE(name), ', ',
    sensitivity, ', ',
    threshold, ', ',
    cooldown, ', ',
    framesToSkip, ', ',
    QUOTE(createdAt), ', ',
    QUOTE(updatedAt), ');'
) FROM MotionSettings;

SELECT 'Backing up SessionRequest table...' as '';
SELECT CONCAT(
    'INSERT INTO SessionRequest (id, driverId, carId, locationId, numberOfLaps, status, createdAt, updatedAt) VALUES (',
    QUOTE(id), ', ',
    QUOTE(driverId), ', ',
    QUOTE(carId), ', ',
    QUOTE(locationId), ', ',
    numberOfLaps, ', ',
    QUOTE(status), ', ',
    QUOTE(createdAt), ', ',
    QUOTE(updatedAt), ');'
) FROM SessionRequest;

SELECT 'Backing up CurrentSession table...' as '';
SELECT CONCAT(
    'INSERT INTO CurrentSession (id, driverName, carName, locationName, lapCount, createdAt, updatedAt) VALUES (',
    QUOTE(id), ', ',
    QUOTE(driverName), ', ',
    QUOTE(carName), ', ',
    QUOTE(locationName), ', ',
    lapCount, ', ',
    QUOTE(createdAt), ', ',
    QUOTE(updatedAt), ');'
) FROM CurrentSession;

SELECT 'Backing up CurrentLap table...' as '';
SELECT CONCAT(
    'INSERT INTO CurrentLap (id, sessionId, lapTime, lapNumber, penaltyCount, createdAt, updatedAt) VALUES (',
    QUOTE(id), ', ',
    QUOTE(sessionId), ', ',
    lapTime, ', ',
    lapNumber, ', ',
    penaltyCount, ', ',
    QUOTE(createdAt), ', ',
    QUOTE(updatedAt), ');'
) FROM CurrentLap;

SET FOREIGN_KEY_CHECKS=1;