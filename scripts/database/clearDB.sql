-- Disable foreign key checks to allow deletion in any order
SET FOREIGN_KEY_CHECKS = 0;

-- Clear all tables
TRUNCATE TABLE rc_lap_timer.Car;
TRUNCATE TABLE rc_lap_timer.CurrentLap;
TRUNCATE TABLE rc_lap_timer.CurrentSession;
TRUNCATE TABLE rc_lap_timer.Driver;
TRUNCATE TABLE rc_lap_timer.Lap;
TRUNCATE TABLE rc_lap_timer.Location;
TRUNCATE TABLE rc_lap_timer.MotionSettings;
TRUNCATE TABLE rc_lap_timer.Penalty;
TRUNCATE TABLE rc_lap_timer.Race;
TRUNCATE TABLE rc_lap_timer.RaceEntry;
TRUNCATE TABLE rc_lap_timer.RaceLap;
TRUNCATE TABLE rc_lap_timer.Session;
TRUNCATE TABLE rc_lap_timer.SessionRequest;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
