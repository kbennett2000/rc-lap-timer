-- Disable foreign key checks to allow for data restoration
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;

-- Get Driver data
SELECT CONCAT(
    'INSERT INTO Driver (id, name, createdAt, updatedAt) VALUES (''',
    id, ''', ''',
    REPLACE(name, '''', '\\'''), ''', ''',
    createdAt, ''', ''',
    updatedAt, ''');'
) AS InsertStatement FROM Driver;

-- Get Location data
SELECT CONCAT(
    'INSERT INTO Location (id, name, createdAt, updatedAt) VALUES (''',
    id, ''', ''',
    REPLACE(name, '''', '\\'''), ''', ''',
    createdAt, ''', ''',
    updatedAt, ''');'
) AS InsertStatement FROM Location;

-- Get Car data
SELECT CONCAT(
    'INSERT INTO Car (id, name, driverId, createdAt, updatedAt) VALUES (''',
    id, ''', ''',
    REPLACE(name, '''', '\\'''), ''', ''',
    driverId, ''', ''',
    createdAt, ''', ''',
    updatedAt, ''');'
) AS InsertStatement FROM Car;

-- Get Session data
SELECT CONCAT(
    'INSERT INTO Session (id, date, driverId, carId, locationId, driverName, carName, locationName, totalTime, totalLaps, notes, createdAt, updatedAt) VALUES (''',
    id, ''', ''',
    date, ''', ''',
    driverId, ''', ''',
    carId, ''', ''',
    locationId, ''', ''',
    REPLACE(driverName, '''', '\\'''), ''', ''',
    REPLACE(carName, '''', '\\'''), ''', ''',
    REPLACE(locationName, '''', '\\'''), ''', ',
    totalTime, ', ',
    totalLaps, ', ',
    CASE WHEN notes IS NULL THEN 'NULL' ELSE CONCAT('''', REPLACE(notes, '''', '\\'''), '''') END, ', ''',
    createdAt, ''', ''',
    updatedAt, ''');'
) AS InsertStatement FROM Session;

-- Get Lap data
SELECT CONCAT(
    'INSERT INTO Lap (id, sessionId, lapNumber, lapTime, createdAt, updatedAt) VALUES (''',
    id, ''', ''',
    sessionId, ''', ',
    lapNumber, ', ',
    lapTime, ', ''',
    createdAt, ''', ''',
    updatedAt, ''');'
) AS InsertStatement FROM Lap;

-- Get Penalty data
SELECT CONCAT(
    'INSERT INTO Penalty (id, sessionId, lapNumber, count, createdAt, updatedAt) VALUES (''',
    id, ''', ''',
    sessionId, ''', ',
    lapNumber, ', ',
    count, ', ''',
    createdAt, ''', ''',
    updatedAt, ''');'
) AS InsertStatement FROM Penalty;

-- Get MotionSettings data
SELECT CONCAT(
    'INSERT INTO MotionSettings (id, name, sensitivity, threshold, cooldown, framesToSkip, createdAt, updatedAt) VALUES (''',
    id, ''', ''',
    REPLACE(name, '''', '\\'''), ''', ',
    sensitivity, ', ',
    threshold, ', ',
    cooldown, ', ',
    framesToSkip, ', ''',
    createdAt, ''', ''',
    updatedAt, ''');'
) AS InsertStatement FROM MotionSettings;

-- Get SessionRequest data
SELECT CONCAT(
    'INSERT INTO SessionRequest (id, driverId, carId, locationId, numberOfLaps, status, createdAt, updatedAt) VALUES (''',
    id, ''', ''',
    driverId, ''', ''',
    carId, ''', ''',
    locationId, ''', ',
    numberOfLaps, ', ''',
    status, ''', ''',
    createdAt, ''', ''',
    updatedAt, ''');'
) AS InsertStatement FROM SessionRequest;

-- Get CurrentSession data
SELECT CONCAT(
    'INSERT INTO CurrentSession (id, driverName, carName, locationName, lapCount, createdAt, updatedAt) VALUES (''',
    id, ''', ''',
    REPLACE(driverName, '''', '\\'''), ''', ''',
    REPLACE(carName, '''', '\\'''), ''', ''',
    REPLACE(locationName, '''', '\\'''), ''', ',
    lapCount, ', ''',
    createdAt, ''', ''',
    updatedAt, ''');'
) AS InsertStatement FROM CurrentSession;

-- Get CurrentLap data
SELECT CONCAT(
    'INSERT INTO CurrentLap (id, sessionId, lapTime, lapNumber, penaltyCount, createdAt, updatedAt) VALUES (''',
    id, ''', ''',
    sessionId, ''', ',
    lapTime, ', ',
    lapNumber, ', ',
    penaltyCount, ', ''',
    createdAt, ''', ''',
    updatedAt, ''');'
) AS InsertStatement FROM CurrentLap;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;