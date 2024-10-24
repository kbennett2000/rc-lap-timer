export interface Driver {
  id: string;
  name: string;
  cars: Car[];
}

export interface Car {
  id: string;
  name: string;
}

export interface LapStats {
  average: number;
  mean: number;
}

export interface Session {
  id: number;
  date: string;
  driverId: string;
  driverName: string;
  carId: string;
  carName: string;
  laps: number[];
  stats: {
    average: number;
    mean: number;
    totalTime: number;  // Add this field
  };
  totalLaps: 'unlimited' | number;
}

export interface StoredData {
  sessions: Session[];
  drivers: Driver[];
}

export interface BestLapRecord {
  sessionId: number;
  date: string;  // This will store the full timestamp
  driverName: string;
  carName: string;
  lapTime: number;
  lapNumber: number;
}

 export interface ComparisonData {
  lapNumber: number;
  [key: string]: number | string; // For dynamic session data
}

export interface PersistentData {
  sessions: Session[];
  drivers: Driver[];
  lastUpdated: string;
}
