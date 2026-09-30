// The backup file: everything the app stores, as one JSON document. The phone-only app saves and restores these, and
// the same format will carry data between phones and the Pi. Restoring merges (see merge.ts), so a file can be
// restored into an app that already has data.

import { checkMotionSettings, cleanCarNumber, cleanName, cleanNotes } from "@/domain/rules";
import type { Car, Driver, Location, MotionSettings, SessionRecord } from "@/domain/types";
import { parseSessionInput } from "@/lib/session-input";

export const BUNDLE_FORMAT = "rc-lap-timer";
export const BUNDLE_SCHEMA_VERSION = 1;

export type RecordKind = "driver" | "car" | "location" | "session" | "motionSettings";
export const RECORD_KINDS: RecordKind[] = ["driver", "car", "location", "session", "motionSettings"];

// Left behind by every delete, including the records a delete cascades to, so a merge can carry deletes.
export interface Tombstone {
  kind: RecordKind;
  id: string;
  deletedAt: string;
}

// A record that a merge folded into another with the same name. Later merges map fromId to toId.
export interface Alias {
  kind: RecordKind;
  fromId: string;
  toId: string;
}

export type DriverRecord = Omit<Driver, "cars">;

export interface BundleData {
  drivers: DriverRecord[];
  cars: Car[];
  locations: Location[];
  sessions: SessionRecord[];
  motionSettings: MotionSettings[];
}

// What a merge works on: the records, plus the deletes and aliases that travel with them.
export interface BundleContents {
  data: BundleData;
  tombstones: Tombstone[];
  aliases: Alias[];
}

export interface Bundle extends BundleContents {
  format: typeof BUNDLE_FORMAT;
  schemaVersion: typeof BUNDLE_SCHEMA_VERSION;
  exportedAt: string;
  // The device that made the file.
  deviceId: string;
}

export const EMPTY_CONTENTS: BundleContents = {
  data: { drivers: [], cars: [], locations: [], sessions: [], motionSettings: [] },
  tombstones: [],
  aliases: [],
};

// --- Reading a file -------------------------------------------------------------------------------------------------

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isId = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const isKind = (value: unknown): value is RecordKind => RECORD_KINDS.includes(value as RecordKind);

// Dates as ISO strings, or null if the value isn't a date.
function isoDate(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// createdAt and updatedAt, or null if either is missing.
function stamps(row: Json): { createdAt: string; updatedAt: string } | null {
  const createdAt = isoDate(row.createdAt);
  const updatedAt = isoDate(row.updatedAt);
  return createdAt && updatedAt ? { createdAt, updatedAt } : null;
}

function readDriver(row: Json): DriverRecord | null {
  const name = cleanName(row.name, "driver");
  const times = stamps(row);
  return isId(row.id) && name.ok && times ? { id: row.id, name: name.value, ...times } : null;
}

function readCar(row: Json): Car | null {
  const name = cleanName(row.name, "car");
  const times = stamps(row);
  if (!isId(row.id) || !isId(row.driverId) || !name.ok || !times) return null;
  const defaultCarNumber = cleanCarNumber(row.defaultCarNumber);
  return { id: row.id, name: name.value, driverId: row.driverId, defaultCarNumber, ...times };
}

function readLocation(row: Json): Location | null {
  const name = cleanName(row.name, "location");
  const times = stamps(row);
  return isId(row.id) && name.ok && times ? { id: row.id, name: name.value, ...times } : null;
}

function readSession(row: Json): SessionRecord | null {
  const parsed = parseSessionInput(row);
  const notes = cleanNotes(row.notes);
  const times = stamps(row);
  if (!parsed.ok || !notes.ok || !times) return null;
  const { session } = parsed;
  const laps = [...session.laps].sort((a, b) => a.lapNumber - b.lapNumber);
  const name = (value: unknown) => (typeof value === "string" ? value : "");
  return {
    id: session.id,
    date: session.date.toISOString(),
    driverId: session.driverId,
    driverName: name(row.driverName),
    carId: session.carId,
    carName: name(row.carName),
    locationId: session.locationId,
    locationName: name(row.locationName),
    laps,
    penalties: [...session.penalties].sort((a, b) => a.lapNumber - b.lapNumber),
    totalTime: laps.reduce((sum, lap) => sum + lap.lapTime, 0),
    totalLaps: laps.length,
    notes: notes.value,
    ...times,
  };
}

function readMotionSettings(row: Json): MotionSettings | null {
  const checked = checkMotionSettings(row);
  const times = stamps(row);
  return isId(row.id) && checked.ok && times ? { id: row.id, ...checked.value, ...times } : null;
}

function readTombstone(row: Json): Tombstone | null {
  const deletedAt = isoDate(row.deletedAt);
  return isKind(row.kind) && isId(row.id) && deletedAt ? { kind: row.kind, id: row.id, deletedAt } : null;
}

function readAlias(row: Json): Alias | null {
  return isKind(row.kind) && isId(row.fromId) && isId(row.toId) && row.fromId !== row.toId
    ? { kind: row.kind, fromId: row.fromId, toId: row.toId }
    : null;
}

export type ParsedBundle = { ok: true; bundle: Bundle; dropped: number } | { ok: false; error: string };

// Reads a backup file's JSON. Records that break the app's rules are left out and counted, so one bad record doesn't
// stop a restore; fields the app doesn't know (from a newer version) are ignored.
export function parseBundle(json: unknown): ParsedBundle {
  if (!isRecord(json) || json.format !== BUNDLE_FORMAT || !isRecord(json.data)) {
    return { ok: false, error: "This isn't an RC Lap Timer backup file." };
  }
  if (typeof json.schemaVersion !== "number" || json.schemaVersion > BUNDLE_SCHEMA_VERSION) {
    return { ok: false, error: "This backup was made by a newer version of the app. Update the app, then try again." };
  }
  if (json.schemaVersion < 1) return { ok: false, error: "This backup file isn't in a format the app can read." };

  let dropped = 0;
  const readAll = <T>(value: unknown, read: (row: Json) => T | null): T[] => {
    const rows = Array.isArray(value) ? value : [];
    const valid: T[] = [];
    for (const row of rows) {
      const record = isRecord(row) ? read(row) : null;
      if (record) valid.push(record);
      else dropped++;
    }
    return valid;
  };

  const data: BundleData = {
    drivers: readAll(json.data.drivers, readDriver),
    cars: readAll(json.data.cars, readCar),
    locations: readAll(json.data.locations, readLocation),
    sessions: readAll(json.data.sessions, readSession),
    motionSettings: readAll(json.data.motionSettings, readMotionSettings),
  };
  const bundle: Bundle = {
    format: BUNDLE_FORMAT,
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    exportedAt: isoDate(json.exportedAt) ?? new Date(0).toISOString(),
    deviceId: isId(json.deviceId) ? json.deviceId : "unknown",
    data,
    tombstones: readAll(json.tombstones, readTombstone),
    aliases: readAll(json.aliases, readAlias),
  };
  return { ok: true, bundle, dropped };
}
