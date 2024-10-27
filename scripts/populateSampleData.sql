-- populate_sample_data.sql
-- This script adds varied sample data across multiple dates

-- Add Drivers with their Cars
INSERT INTO Driver (id, name, createdAt, updatedAt) VALUES
('d1', 'Alice', NOW(), NOW()),
('d2', 'Bob', NOW(), NOW()),
('d3', 'Charlie', NOW(), NOW()),
('d4', 'Diana', NOW(), NOW()),
('d5', 'Ethan', NOW(), NOW());

-- Add Cars for each Driver
INSERT INTO Car (id, name, driverId, createdAt, updatedAt) VALUES
-- Alice's cars
('c1', 'SC10 Pro2', 'd1', NOW(), NOW()),
('c2', 'B74.1D', 'd1', NOW(), NOW()),
('c3', 'TLR 22 5.0', 'd1', NOW(), NOW()),
-- Bob's cars
('c4', 'Slash 2wd', 'd2', NOW(), NOW()),
('c5', 'RC8.3e', 'd2', NOW(), NOW()),
-- Charlie's cars
('c6', 'Tekno EB410', 'd3', NOW(), NOW()),
('c7', 'Team Associated RC8', 'd3', NOW(), NOW()),
-- Diana's cars
('c8', 'Traxxas XO-1', 'd4', NOW(), NOW()),
('c9', 'Losi 8IGHT-XE', 'd4', NOW(), NOW()),
-- Ethan's cars
('c10', 'HB D819RS', 'd5', NOW(), NOW()),
('c11', 'Tekno NB48', 'd5', NOW(), NOW());

-- Add Sessions spanning different dates and scenarios

-- Today: Alice practicing with consistent laps
INSERT INTO Session (id, date, driverId, carId, driverName, carName, totalLaps, totalTime, createdAt, updatedAt)
VALUES ('s1', NOW(), 'd1', 'c1', 'Alice', 'SC10 Pro2', 5, 17348, NOW(), NOW());

INSERT INTO Lap (id, sessionId, lapNumber, lapTime, createdAt, updatedAt) VALUES
('l1_1', 's1', 1, 3427, NOW(), NOW()),
('l1_2', 's1', 2, 3482, NOW(), NOW()),
('l1_3', 's1', 3, 3419, NOW(), NOW()),
('l1_4', 's1', 4, 3520, NOW(), NOW()),
('l1_5', 's1', 5, 3500, NOW(), NOW());

-- Yesterday: Bob with penalties but improving
INSERT INTO Session (id, date, driverId, carId, driverName, carName, totalLaps, totalTime, createdAt, updatedAt)
VALUES ('s2', DATE_SUB(NOW(), INTERVAL 1 DAY), 'd2', 'c4', 'Bob', 'Slash 2wd', 5, 18500, NOW(), NOW());

INSERT INTO Lap (id, sessionId, lapNumber, lapTime, createdAt, updatedAt) VALUES
('l2_1', 's2', 1, 4000, NOW(), NOW()),
('l2_2', 's2', 2, 3800, NOW(), NOW()),
('l2_3', 's2', 3, 3600, NOW(), NOW()),
('l2_4', 's2', 4, 3500, NOW(), NOW()),
('l2_5', 's2', 5, 3400, NOW(), NOW());

INSERT INTO Penalty (id, sessionId, lapNumber, count, createdAt, updatedAt) VALUES
('p2_1', 's2', 2, 2, NOW(), NOW()),
('p2_2', 's2', 4, 1, NOW(), NOW());

-- Last week: Charlie's best session
INSERT INTO Session (id, date, driverId, carId, driverName, carName, totalLaps, totalTime, createdAt, updatedAt)
VALUES ('s3', DATE_SUB(NOW(), INTERVAL 7 DAY), 'd3', 'c6', 'Charlie', 'Tekno EB410', 5, 16500, NOW(), NOW());

INSERT INTO Lap (id, sessionId, lapNumber, lapTime, createdAt, updatedAt) VALUES
('l3_1', 's3', 1, 3200, NOW(), NOW()),
('l3_2', 's3', 2, 3300, NOW(), NOW()),
('l3_3', 's3', 3, 3400, NOW(), NOW()),
('l3_4', 's3', 4, 3300, NOW(), NOW()),
('l3_5', 's3', 5, 3300, NOW(), NOW());

-- Two weeks ago: Diana's first session
INSERT INTO Session (id, date, driverId, carId, driverName, carName, totalLaps, totalTime, createdAt, updatedAt)
VALUES ('s4', DATE_SUB(NOW(), INTERVAL 14 DAY), 'd4', 'c8', 'Diana', 'Traxxas XO-1', 5, 21000, NOW(), NOW());

INSERT INTO Lap (id, sessionId, lapNumber, lapTime, createdAt, updatedAt) VALUES
('l4_1', 's4', 1, 4500, NOW(), NOW()),
('l4_2', 's4', 2, 4200, NOW(), NOW()),
('l4_3', 's4', 3, 4100, NOW(), NOW()),
('l4_4', 's4', 4, 4100, NOW(), NOW()),
('l4_5', 's4', 5, 4100, NOW(), NOW());

INSERT INTO Penalty (id, sessionId, lapNumber, count, createdAt, updatedAt) VALUES
('p4_1', 's4', 1, 3, NOW(), NOW()),
('p4_2', 's4', 2, 1, NOW(), NOW());

-- One month ago: Ethan's fastest session
INSERT INTO Session (id, date, driverId, carId, driverName, carName, totalLaps, totalTime, createdAt, updatedAt)
VALUES ('s5', DATE_SUB(NOW(), INTERVAL 1 MONTH), 'd5', 'c10', 'Ethan', 'HB D819RS', 5, 15500, NOW(), NOW());

INSERT INTO Lap (id, sessionId, lapNumber, lapTime, createdAt, updatedAt) VALUES
('l5_1', 's5', 1, 3000, NOW(), NOW()),
('l5_2', 's5', 2, 3100, NOW(), NOW()),
('l5_3', 's5', 3, 3200, NOW(), NOW()),
('l5_4', 's5', 4, 3100, NOW(), NOW()),
('l5_5', 's5', 5, 3100, NOW(), NOW());

-- Three months ago: Alice with different car
INSERT INTO Session (id, date, driverId, carId, driverName, carName, totalLaps, totalTime, createdAt, updatedAt)
VALUES ('s6', DATE_SUB(NOW(), INTERVAL 3 MONTH), 'd1', 'c2', 'Alice', 'B74.1D', 5, 17000, NOW(), NOW());

INSERT INTO Lap (id, sessionId, lapNumber, lapTime, createdAt, updatedAt) VALUES
('l6_1', 's6', 1, 3400, NOW(), NOW()),
('l6_2', 's6', 2, 3300, NOW(), NOW()),
('l6_3', 's6', 3, 3400, NOW(), NOW()),
('l6_4', 's6', 4, 3500, NOW(), NOW()),
('l6_5', 's6', 5, 3400, NOW(), NOW());

-- Six months ago: Bob's first session
INSERT INTO Session (id, date, driverId, carId, driverName, carName, totalLaps, totalTime, createdAt, updatedAt)
VALUES ('s7', DATE_SUB(NOW(), INTERVAL 6 MONTH), 'd2', 'c5', 'Bob', 'RC8.3e', 5, 20000, NOW(), NOW());

INSERT INTO Lap (id, sessionId, lapNumber, lapTime, createdAt, updatedAt) VALUES
('l7_1', 's7', 1, 4200, NOW(), NOW()),
('l7_2', 's7', 2, 4000, NOW(), NOW()),
('l7_3', 's7', 3, 4000, NOW(), NOW()),
('l7_4', 's7', 4, 3900, NOW(), NOW()),
('l7_5', 's7', 5, 3900, NOW(), NOW());

INSERT INTO Penalty (id, sessionId, lapNumber, count, createdAt, updatedAt) VALUES
('p7_1', 's7', 1, 2, NOW(), NOW()),
('p7_2', 's7', 3, 1, NOW(), NOW());