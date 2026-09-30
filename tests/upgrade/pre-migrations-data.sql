-- Data in a timer's database from before migrations (the pre-migrations.prisma schema), for test-upgrade-db.sh:
-- a driver, car and location, a practice session with two laps and a penalty, and saved motion settings.
INSERT INTO Driver (id, name, createdAt, updatedAt)
  VALUES ('0b8e1c5a-6d2f-4f3a-9c41-1a2b3c4d5e01', 'Upgrade Driver', NOW(3), NOW(3));
INSERT INTO Location (id, name, createdAt, updatedAt)
  VALUES ('0b8e1c5a-6d2f-4f3a-9c41-1a2b3c4d5e02', 'Upgrade Track', NOW(3), NOW(3));
INSERT INTO Car (id, name, driverId, createdAt, updatedAt, defaultCarNumber)
  VALUES ('0b8e1c5a-6d2f-4f3a-9c41-1a2b3c4d5e03', 'Upgrade Car', '0b8e1c5a-6d2f-4f3a-9c41-1a2b3c4d5e01', NOW(3), NOW(3), 3);
INSERT INTO Session (id, date, driverId, carId, driverName, carName, totalTime, totalLaps, notes, createdAt, updatedAt,
    locationId, locationName)
  VALUES ('0b8e1c5a-6d2f-4f3a-9c41-1a2b3c4d5e04', '2025-06-01 10:00:00.000', '0b8e1c5a-6d2f-4f3a-9c41-1a2b3c4d5e01',
    '0b8e1c5a-6d2f-4f3a-9c41-1a2b3c4d5e03', 'Upgrade Driver', 'Upgrade Car', 3000, 2, 'Windy', NOW(3), NOW(3),
    '0b8e1c5a-6d2f-4f3a-9c41-1a2b3c4d5e02', 'Upgrade Track');
INSERT INTO Lap (id, sessionId, lapNumber, lapTime, createdAt, updatedAt)
  VALUES ('0b8e1c5a-6d2f-4f3a-9c41-1a2b3c4d5e05', '0b8e1c5a-6d2f-4f3a-9c41-1a2b3c4d5e04', 1, 1400, NOW(3), NOW(3)),
         ('0b8e1c5a-6d2f-4f3a-9c41-1a2b3c4d5e06', '0b8e1c5a-6d2f-4f3a-9c41-1a2b3c4d5e04', 2, 1600, NOW(3), NOW(3));
INSERT INTO Penalty (id, sessionId, lapNumber, count, createdAt, updatedAt)
  VALUES ('0b8e1c5a-6d2f-4f3a-9c41-1a2b3c4d5e07', '0b8e1c5a-6d2f-4f3a-9c41-1a2b3c4d5e04', 2, 1, NOW(3), NOW(3));
INSERT INTO MotionSettings (id, name, sensitivity, threshold, cooldown, createdAt, updatedAt, framesToSkip)
  VALUES ('0b8e1c5a-6d2f-4f3a-9c41-1a2b3c4d5e08', 'Upgrade Settings', 100, 1.5, 5000, NOW(3), NOW(3), 30);
