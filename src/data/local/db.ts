// The phone-only app's database (IndexedDB, through Dexie). Rows are the domain records plus nameKey, the form names
// are compared in (see nameKey in src/domain/rules.ts); drivers are stored without their cars.

import Dexie, { type DexieOptions, type EntityTable, type Table } from "dexie";
import type { Car, Driver, Location, MotionSettings, SessionRecord } from "@/domain/types";

export type DriverRow = Omit<Driver, "cars"> & { nameKey: string };
export type CarRow = Car & { nameKey: string };
export type LocationRow = Location & { nameKey: string };
export type MotionSettingsRow = MotionSettings & { nameKey: string };
export type SessionRow = SessionRecord;

export type RecordKind = "driver" | "car" | "location" | "session" | "motionSettings";

// Left behind by every delete, including the records a delete cascades to, so backups and sync can carry deletes.
export interface Tombstone {
  kind: RecordKind;
  id: string;
  deletedAt: string;
}

// A record that was merged into another with the same name (backups and sync record these).
export interface Alias {
  kind: RecordKind;
  fromId: string;
  toId: string;
}

// Small settings, such as when the last backup was made.
export interface MetaRow {
  key: string;
  value: string;
}

// Every project site on kbennett2000.github.io shares one origin, and so one set of IndexedDB databases.
export const DATABASE_NAME = "rc-lap-timer";

export class LapTimerDB extends Dexie {
  drivers!: EntityTable<DriverRow, "id">;
  cars!: EntityTable<CarRow, "id">;
  locations!: EntityTable<LocationRow, "id">;
  sessions!: EntityTable<SessionRow, "id">;
  motionSettings!: EntityTable<MotionSettingsRow, "id">;
  tombstones!: Table<Tombstone, [RecordKind, string]>;
  aliases!: Table<Alias, [RecordKind, string]>;
  meta!: EntityTable<MetaRow, "key">;

  // Tests pass their own indexedDB and IDBKeyRange (from fake-indexeddb).
  constructor(options?: DexieOptions) {
    super(DATABASE_NAME, options);
    this.version(1).stores({
      drivers: "id, &nameKey",
      cars: "id, driverId, &[driverId+nameKey]",
      locations: "id, &nameKey",
      sessions: "id, driverId, carId, locationId, date",
      motionSettings: "id, &nameKey",
      tombstones: "[kind+id], deletedAt",
      aliases: "[kind+fromId]",
      meta: "key",
    });
  }
}
