// types/race-timer.ts

import { Race as PrismaRace, RaceEntry as PrismaRaceEntry, RaceLap as PrismaRaceLap } from "@prisma/client";
import { Driver, Car, Location } from "./rc-timer";

export type RaceStatus = "PENDING" | "COUNTDOWN" | "RACING" | "PAUSED" | "FINISHED" | "STOPPED";
export type RaceEntryStatus = "REGISTERED" | "RACING" | "FINISHED" | "DNF";

export interface RaceLap extends PrismaRaceLap {
  raceEntryId: string;
  lapNumber: number;
  lapTime: number;
  position: number;
  gap: number;
  timestamp: Date;
}

export interface RaceEntry extends Omit<PrismaRaceEntry, "createdAt" | "updatedAt"> {
  driver: Driver;
  car: Car;
  carNumber: number;
  position?: number;
  lapsCompleted: number;
  bestLapTime?: number;
  totalTime?: number;
  status: RaceEntryStatus;
  laps: RaceLap[];
  dnfReason?: string;
}

export interface Race extends Omit<PrismaRace, "date" | "startTime" | "endTime" | "createdAt" | "updatedAt"> {
  name: string;
  date: string;
  location: Location;
  status: RaceStatus;
  startDelay: number;
  totalLaps?: number;
  startTime?: string;
  endTime?: string;
  entries: RaceEntry[];
  notes?: string;
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
  data?: any;
}
