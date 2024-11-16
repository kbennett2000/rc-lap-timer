-- backupDB.sql - Creates the backup of all data
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;

SELECT CONCAT('INSERT INTO Driver VALUES(', 
  QUOTE(id), ',', 
  QUOTE(name), ',', 
  QUOTE(createdAt), ',',
  QUOTE(updatedAt), ');') AS ''
FROM Driver;

SELECT CONCAT('INSERT INTO Location VALUES(', 
  QUOTE(id), ',', 
  QUOTE(name), ',', 
  QUOTE(createdAt), ',',
  QUOTE(updatedAt), ');') AS ''
FROM Location;

SELECT CONCAT('INSERT INTO Car VALUES(', 
  QUOTE(id), ',', 
  QUOTE(name), ',',
  QUOTE(driverId), ',',
  QUOTE(createdAt), ',',
  QUOTE(updatedAt), ');') AS ''
FROM Car;

SELECT CONCAT('INSERT INTO Session VALUES(', 
  QUOTE(id), ',', 
  QUOTE(date), ',',
  QUOTE(driverId), ',',
  QUOTE(carId), ',',
  QUOTE(locationId), ',',
  QUOTE(driverName), ',',
  QUOTE(carName), ',',
  QUOTE(locationName), ',',
  totalTime, ',',
  totalLaps, ',',
  IFNULL(QUOTE(notes), 'NULL'), ',',
  QUOTE(createdAt), ',',
  QUOTE(updatedAt), ');') AS ''
FROM Session;

SELECT CONCAT('INSERT INTO Lap VALUES(', 
  QUOTE(id), ',', 
  QUOTE(sessionId), ',',
  lapNumber, ',',
  lapTime, ',',
  QUOTE(createdAt), ',',
  QUOTE(updatedAt), ');') AS ''
FROM Lap;

SELECT CONCAT('INSERT INTO Penalty VALUES(', 
  QUOTE(id), ',', 
  QUOTE(sessionId), ',',
  lapNumber, ',',
  count, ',',
  QUOTE(createdAt), ',',
  QUOTE(updatedAt), ');') AS ''
FROM Penalty;

SELECT CONCAT('INSERT INTO MotionSettings VALUES(', 
  QUOTE(id), ',', 
  QUOTE(name), ',',
  sensitivity, ',',
  threshold, ',',
  cooldown, ',',
  framesToSkip, ',',
  QUOTE(createdAt), ',',
  QUOTE(updatedAt), ');') AS ''
FROM MotionSettings;

SELECT CONCAT('INSERT INTO SessionRequest VALUES(', 
  QUOTE(id), ',', 
  QUOTE(driverId), ',',
  QUOTE(carId), ',',
  QUOTE(locationId), ',',
  numberOfLaps, ',',
  QUOTE(status), ',',
  QUOTE(createdAt), ',',
  QUOTE(updatedAt), ');') AS ''
FROM SessionRequest;

SELECT CONCAT('INSERT INTO CurrentSession VALUES(', 
  QUOTE(id), ',', 
  QUOTE(driverName), ',',
  QUOTE(carName), ',',
  QUOTE(locationName), ',',
  lapCount, ',',
  QUOTE(createdAt), ',',
  QUOTE(updatedAt), ');') AS ''
FROM CurrentSession;

SELECT CONCAT('INSERT INTO CurrentLap VALUES(', 
  QUOTE(id), ',', 
  QUOTE(sessionId), ',',
  lapTime, ',',
  lapNumber, ',',
  penaltyCount, ',',
  QUOTE(createdAt), ',',
  QUOTE(updatedAt), ');') AS ''
FROM CurrentLap;

SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
