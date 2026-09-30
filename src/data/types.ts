// The contract between the screens and wherever the data lives: the Pi's API today (api-data-store.ts), the phone
// itself in the phone-only build. Every store follows the same rules, checked by tests/datastore/conformance.ts:
//
// - Names are trimmed, 1 to 191 characters, and unique ignoring case; car names are unique per driver.
// - Renaming a driver, car or location updates the name copies on its saved sessions.
// - Deleting a driver deletes its cars and their sessions; deleting a car or a location deletes its sessions.
// - Saving a session is idempotent by id. Lap times are whole milliseconds, laps come back in lap order, and the
//   store fills in the names, totalTime and totalLaps. Deleting anything twice is a no-op.
// - Failures are DataStoreErrors; their message is what the user sees.

import type { MotionSettingsInput } from "@/domain/rules";
import type { Car, Driver, Location, MotionSettings, NewSession, SessionRecord } from "@/domain/types";

export type { MotionSettingsInput };

export interface DataSnapshot {
  drivers: Driver[];
  locations: Location[];
  sessions: SessionRecord[];
}

export interface NewCar {
  driverId: string;
  name: string;
  defaultCarNumber: number | null;
}

export interface CarChanges {
  name: string;
  // null clears it.
  defaultCarNumber: number | null;
}

export interface DataStore {
  // Drivers (with their cars, both by name), locations (by name) and saved sessions, read together.
  loadSnapshot(): Promise<DataSnapshot>;

  createDriver(name: string): Promise<Driver>;
  renameDriver(id: string, name: string): Promise<void>;
  deleteDriver(id: string): Promise<void>;

  createCar(car: NewCar): Promise<Car>;
  updateCar(id: string, changes: CarChanges): Promise<void>;
  deleteCar(id: string): Promise<void>;

  createLocation(name: string): Promise<Location>;
  renameLocation(id: string, name: string): Promise<void>;
  deleteLocation(id: string): Promise<void>;

  // created is false when a session with this id was already saved.
  saveSession(session: NewSession): Promise<{ created: boolean }>;
  // An empty note clears it.
  updateSessionNotes(id: string, notes: string | null): Promise<void>;
  deleteSession(id: string): Promise<void>;

  // By name.
  listMotionSettings(): Promise<MotionSettings[]>;
  createMotionSettings(input: MotionSettingsInput): Promise<MotionSettings>;
  updateMotionSettings(id: string, input: MotionSettingsInput): Promise<void>;
  deleteMotionSettings(id: string): Promise<void>;
}

// duplicate: the name is in use. invalid: the request breaks a rule (or refers to a record that's gone).
// not-found: the record to change doesn't exist. unavailable: the store can't be reached; trying again may work.
export type DataErrorKind = "duplicate" | "invalid" | "not-found" | "unavailable";

export class DataStoreError extends Error {
  constructor(
    readonly kind: DataErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "DataStoreError";
  }
}
