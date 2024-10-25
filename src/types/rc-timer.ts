export interface BestLapRecord {
  sessionId: number;
  date: string;
  driverName: string;
  carName: string;
  lapTime: number;
  lapNumber: number;
  penalties?: number; // Optional: if you want to show penalties in best laps
}

export interface Car {
  id: string;
  name: string;
}

export interface ComparisonData {
  lapNumber: number;
  [key: string]: number | string;
}

export interface Driver {
  id: string;
  name: string;
  cars: Car[];
}

export interface LapStats {
  average: number;
  mean: number;
  totalTime: number;
  maxPenaltyLap: number | null;
  maxPenaltyCount: number;
}

export interface PenaltyData {
  lapNumber: number;
  count: number;
}

export interface PersistentData {
  sessions: Session[];
  drivers: Driver[];
  lastUpdated: string;
}

export interface Session {
  id: number;
  date: string;
  driverId: string;
  driverName: string;
  carId: string;
  carName: string;
  laps: number[];
  stats: LapStats;
  totalLaps: "unlimited" | number;
  penalties: PenaltyData[];
  totalPenalties: number;
}
