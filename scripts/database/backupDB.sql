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
  IFNULL(defaultCarNumber, 'NULL'), ',',
  QUOTE(createdAt), ',',
  QUOTE(updatedAt), ');') AS ''
FROM Car;

SELECT CONCAT('INSERT INTO Session VALUES(', 
  QUOTE(id), ',', 
  QUOTE(date), ',',
  QUOTE(driverId), ',',
  QUOTE(carId), ',',
  QUOTE(driverName), ',',
  QUOTE(carName), ',',
  totalTime, ',',
  totalLaps, ',',
  IFNULL(QUOTE(notes), 'NULL'), ',',
  QUOTE(createdAt), ',',
  QUOTE(updatedAt), ',',
  QUOTE(locationId), ',',
  QUOTE(locationName), ');') AS ''
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

-- New tables for Race functionality
SELECT CONCAT('INSERT INTO Race VALUES(', 
  QUOTE(id), ',', 
  QUOTE(name), ',',
  QUOTE(date), ',',
  QUOTE(locationId), ',',
  QUOTE(status), ',',
  startDelay, ',',
  IFNULL(totalLaps, 'NULL'), ',',
  IFNULL(QUOTE(startTime), 'NULL'), ',',
  IFNULL(QUOTE(endTime), 'NULL'), ',',
  IFNULL(QUOTE(notes), 'NULL'), ',',
  QUOTE(createdAt), ',',
  QUOTE(updatedAt), ');') AS ''
FROM Race;

SELECT CONCAT('INSERT INTO RaceEntry VALUES(', 
  QUOTE(id), ',', 
  QUOTE(raceId), ',',
  QUOTE(driverId), ',',
  QUOTE(carId), ',',
  carNumber, ',',
  IFNULL(position, 'NULL'), ',',
  lapsCompleted, ',',
  IFNULL(bestLapTime, 'NULL'), ',',
  IFNULL(totalTime, 'NULL'), ',',
  QUOTE(status), ',',
  IFNULL(QUOTE(dnfReason), 'NULL'), ',',
  QUOTE(createdAt), ',',
  QUOTE(updatedAt), ');') AS ''
FROM RaceEntry;

SELECT CONCAT('INSERT INTO RaceLap VALUES(', 
  QUOTE(id), ',', 
  QUOTE(raceEntryId), ',',
  lapNumber, ',',
  lapTime, ',',
  position, ',',
  gap, ',',
  QUOTE(timestamp), ',',
  QUOTE(createdAt), ',',
  QUOTE(updatedAt), ');') AS ''
FROM RaceLap;

SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
