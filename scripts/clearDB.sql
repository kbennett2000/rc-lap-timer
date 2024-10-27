-- clear_all_data.sql
-- This script removes all data from the RC Lap Timer database

-- Disable foreign key checks to allow deletion in any order
SET FOREIGN_KEY_CHECKS = 0;

-- Clear all tables
TRUNCATE TABLE Penalty;
TRUNCATE TABLE Lap;
TRUNCATE TABLE Session;
TRUNCATE TABLE Car;
TRUNCATE TABLE Driver;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;