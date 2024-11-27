// src/app/api/races/types.ts
import { Race as PrismaRace, RaceEntry as PrismaRaceEntry } from "@prisma/client";

export interface CreateRaceRequest {
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

export interface RecordLapRequest {
  carNumber: number;
  timestamp: number;
}

export interface DNFRequest {
  carNumber: number;
  reason?: string;
}

export interface UpdateRaceRequest {
  status: "PENDING" | "COUNTDOWN" | "RACING" | "PAUSED" | "FINISHED" | "STOPPED";
}

export interface RaceState {
  raceId: string;
  status: string;
  entries: {
    carNumber: number;
    driverName: string;
    carName: string;
    position: number;
    lapsCompleted: number;
    lastLapTime?: number;
    bestLapTime?: number;
    gapToLeader?: number;
    status: string;
  }[];
}

export interface CountdownStartRequest {
  duration?: number; // Optional override for race's startDelay
}

export interface CleanupResponse {
  success: boolean;
  deletedRaceId: string;
}
