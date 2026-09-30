// Shapes of the data the UI gets from /api/data. These are JSON, so dates arrive as ISO strings.

export interface Driver {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  cars: Car[];
}

export interface Car {
  id: string;
  name: string;
  driverId: string;
  defaultCarNumber?: number | null;
  createdAt?: string;
  updatedAt?: string;
  driver?: Driver;
}

export interface Session {
  id: string;
  date: string;
  driverId: string;
  driverName: string;
  carId: string;
  carName: string;
  locationId: string;
  locationName: string;
  driver: Driver;
  car: Car;
  laps: Lap[];
  penalties: PenaltyData[];
  stats: LapStats;
  totalTime: number;
  totalLaps: "unlimited" | number;
  totalPenalties: number;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface LapStats {
  average: number;
  totalTime: number;
  bestLap: number;
  worstLap: number;
  maxPenaltyLap: number | null;
  maxPenaltyCount: number;
  totalPenalties: number;
}

export interface BestLapRecord {
  sessionId: string;
  date: string;
  driverName: string;
  carName: string;
  lapTime: number;
  lapNumber: number;
  penalties: number;
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

export interface Location {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
