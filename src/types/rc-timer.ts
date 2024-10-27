import { Driver as PrismaDriver, Car as PrismaCar, Session as PrismaSession, Lap, Penalty } from "@prisma/client";

// Extend Prisma types with any additional properties we need
export interface Driver extends PrismaDriver {
  cars: Car[];
}

export interface Car extends PrismaCar {
  driver?: Driver;
}

export interface Session extends Omit<PrismaSession, "date"> {
  id: string; // Make sure id is required
  driver: Driver;
  car: Car;
  laps: Lap[];
  penalties: Penalty[];
  date: string;
  stats: LapStats;

  driverId: string;
  driverName: string;
  carId: string;
  carName: string;
  totalLaps: "unlimited" | number;
  totalPenalties: number;
  notes?: string;
}

export interface LapStats {
  average: number;
  mean: number;
  totalTime: number;
  maxPenaltyLap: number | null;
  maxPenaltyCount: number;
}

// Other interfaces remain the same
export interface BestLapRecord {
  sessionId: string;
  date: string;
  driverName: string;
  carName: string;
  lapTime: number;
  lapNumber: number;
  penalties?: number;
}

export interface ComparisonData {
  lap: number;
  [key: string]: number | null;
}

export interface PenaltyData {
  lapNumber: number;
  count: number;
}

export interface Lap {
  lapNumber: number;
  lapTime: number;
}
