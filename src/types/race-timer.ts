// types/race-timer.ts

import { Driver, Car, Location } from "./rc-timer";

export type RaceStatus = "PENDING" | "COUNTDOWN" | "RACING" | "PAUSED" | "FINISHED" | "STOPPED";
export type RaceEntryStatus = "REGISTERED" | "RACING" | "FINISHED" | "DNF";

// Shapes of the race data the UI gets from /api/races. JSON, so dates arrive as ISO strings.

export interface RaceLap {
  id: string;
  raceEntryId: string;
  lapNumber: number;
  lapTime: number;
  position: number;
  gap: number;
  timestamp: string;
}

export interface RaceEntry {
  id: string;
  raceId: string;
  driverId: string;
  carId: string;
  driver: Driver;
  car: Car;
  carNumber: number;
  position?: number | null;
  lapsCompleted: number;
  bestLapTime?: number | null;
  totalTime?: number | null;
  status: RaceEntryStatus;
  laps: RaceLap[];
  dnfReason?: string | null;
}

export interface Race {
  id: string;
  name: string;
  date: string;
  locationId: string;
  location: Location;
  status: RaceStatus;
  startDelay: number;
  totalLaps?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  entries: RaceEntry[];
  notes?: string | null;
}

export interface LiveRaceStats {
  position: number;
  lastLapTime?: number;
  bestLapTime?: number;
  gapToLeader?: number;
  lapsCompleted: number;
  isLeader: boolean;
}

export interface LiveRaceData {
  raceId: string;
  status: RaceStatus;
  countdown?: number;
  elapsedTime: number;
  entries: {
    [carNumber: string]: LiveRaceStats;
  };
}

export interface RaceResults {
  raceId: string;
  name: string;
  date: string;
  location: string;
  totalLaps?: number;
  duration: number;
  entries: {
    position: number;
    driverName: string;
    carName: string;
    carNumber: number;
    lapsCompleted: number;
    bestLapTime?: number;
    totalTime?: number;
    status: RaceEntryStatus;
    dnfReason?: string;
  }[];
  fastestLap: {
    driverName: string;
    carName: string;
    lapNumber: number;
    lapTime: number;
  };
}

export interface RaceConfiguration {
  name: string;
  locationId: string;
  startDelay: number;
  totalLaps?: number;
  entries: {
    driverId: string;
    carId: string;
    carNumber: number;
  }[];
}

export interface RaceControlState {
  isPaused: boolean;
  countdown?: number;
  elapsedTime: number;
  lastUpdate: number;
}

export interface RaceEntryUpdate {
  raceId: string;
  carNumber: number;
  timestamp: number;
}

export interface RaceTimingEvent {
  type: "LAP_COMPLETED" | "RACE_STARTED" | "RACE_FINISHED" | "RACE_PAUSED" | "RACE_RESUMED" | "DNF";
  raceId: string;
  carNumber?: number;
  timestamp: number;
  data?: unknown;
}
