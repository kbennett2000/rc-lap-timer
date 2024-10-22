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
  stats: LapStats;
}

export interface StoredData {
  sessions: Session[];
  drivers: Driver[];
}
