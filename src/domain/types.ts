// The app's data, as every data store returns it (see src/data/types.ts). Dates are ISO strings.

export interface Driver {
  id: string;
  name: string;
  cars: Car[];
  createdAt: string;
  updatedAt: string;
}

export interface Car {
  id: string;
  name: string;
  driverId: string;
  // The IR beacon number used when this car is timed with IR (Pi only).
  defaultCarNumber: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Location {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Lap {
  lapNumber: number;
  lapTime: number;
}

export interface PenaltyData {
  lapNumber: number;
  count: number;
}

// A finished practice run as it is saved. The driver, car and location names are copies, kept in step on renames.
export interface SessionRecord {
  id: string;
  // When the run started.
  date: string;
  driverId: string;
  driverName: string;
  carId: string;
  carName: string;
  locationId: string;
  locationName: string;
  // In lap order.
  laps: Lap[];
  penalties: PenaltyData[];
  totalTime: number;
  totalLaps: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// A saved session with its statistics, as the screens show it.
export interface Session extends SessionRecord {
  stats: LapStats;
}

// A finished run to save. The store fills in the totals, and takes the names from its own records.
export interface NewSession {
  id: string;
  date: string;
  driverId: string;
  driverName: string;
  carId: string;
  carName: string;
  locationId: string;
  locationName: string;
  laps: Lap[];
  penalties: PenaltyData[];
}

export interface MotionSettings {
  id: string;
  name: string;
  sensitivity: number;
  threshold: number;
  cooldown: number;
  framesToSkip: number;
  createdAt: string;
  updatedAt: string;
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
