// The DataStore for the phone-only app: everything lives on the phone, in IndexedDB. It follows the same rules as the
// Pi (tests/datastore/conformance.ts), using the same rule code (src/domain/rules.ts, src/lib/session-input.ts).

import {
  checkMotionSettings,
  cleanCarNumber,
  cleanName,
  cleanNotes,
  duplicateNameMessage,
  nameKey,
  type EntityKind,
} from "@/domain/rules";
import { BUNDLE_FORMAT, BUNDLE_SCHEMA_VERSION, type Bundle, type BundleContents } from "@/domain/sync/bundle";
import { mergeBundles, planWrites, type TableWrites } from "@/domain/sync/merge";
import type { Car, Driver, Location, MotionSettings, SessionRecord } from "@/domain/types";
import { parseSessionInput } from "@/lib/session-input";
import { newId } from "@/lib/utils";
import { DataStoreError, type BackupStore, type DataStore } from "../types";
import {
  LapTimerDB,
  type CarRow,
  type DriverRow,
  type LocationRow,
  type MotionSettingsRow,
  type RecordKind,
} from "./db";

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);
const now = () => new Date().toISOString();

function withoutNameKey<T extends { nameKey: string }>({ nameKey: _nameKey, ...record }: T): Omit<T, "nameKey"> {
  return record;
}

function checkedName(value: unknown, kind: EntityKind): string {
  const name = cleanName(value, kind);
  if (!name.ok) throw new DataStoreError("invalid", name.error);
  return name.value;
}

const errorName = (error: unknown): string | undefined =>
  typeof error === "object" && error !== null && "name" in error ? String(error.name) : undefined;

// Storage failures, as DataStoreErrors. Safari can wrap the real error (a full disk, say) in an AbortError.
function toStoreError(error: unknown): DataStoreError {
  if (error instanceof DataStoreError) return error;
  const names = [errorName(error), errorName((error as { inner?: unknown } | null)?.inner)];
  if (names.includes("ConstraintError")) return new DataStoreError("duplicate", "That name is already in use");
  if (names.includes("QuotaExceededError")) {
    return new DataStoreError("unavailable", "Couldn't save on this phone: its storage is full.");
  }
  if (names.some((name) => name && ["DatabaseClosedError", "VersionError", "OpenFailedError"].includes(name))) {
    return new DataStoreError(
      "unavailable",
      "The app's storage on this phone isn't open. Reload the app and try again.",
    );
  }
  if (names.includes("MissingAPIError")) {
    return new DataStoreError("unavailable", "This browser won't let the app store data. Try another browser.");
  }
  const detail = error instanceof Error ? error.message : String(error);
  return new DataStoreError("unavailable", `Couldn't save on this phone: ${detail}`);
}

export function createLocalDataStore(db: LapTimerDB = new LapTimerDB()): DataStore & BackupStore {
  const tables = [
    db.drivers,
    db.cars,
    db.locations,
    db.sessions,
    db.motionSettings,
    db.tombstones,
    db.aliases,
    db.meta,
  ];

  // Every change runs in one read-write transaction, so it happens completely or not at all. Nothing but database
  // calls may be awaited inside one: the transaction commits as soon as it has nothing left to do.
  async function change<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await db.transaction("rw", tables, work);
    } catch (error) {
      throw toStoreError(error);
    }
  }

  async function read<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await db.transaction("r", tables, work);
    } catch (error) {
      throw toStoreError(error);
    }
  }

  // Records a delete, for backups and sync.
  async function bury(kind: RecordKind, ids: string[]) {
    const deletedAt = now();
    await db.tombstones.bulkPut(ids.map((id) => ({ kind, id, deletedAt })));
  }

  // The sessions recorded with a driver, car or location: they go when it goes.
  async function deleteSessions(ids: string[]) {
    await bury("session", ids);
    await db.sessions.bulkDelete(ids);
  }

  async function sessionIdsWhere(field: "driverId" | "carId" | "locationId", ids: string[]) {
    return ids.length === 0 ? [] : ((await db.sessions.where(field).anyOf(ids).primaryKeys()) as string[]);
  }

  // The record an id now stands for: a restore may have folded it into another with the same name.
  async function resolve(kind: RecordKind, id: string): Promise<string> {
    let current = id;
    for (let hop = 0; hop < 10; hop++) {
      const alias = await db.aliases.get([kind, current]);
      if (!alias) break;
      current = alias.toId;
    }
    return current;
  }

  // Everything stored, as a backup's contents (rows without their name keys).
  async function readContents(): Promise<BundleContents> {
    const [drivers, cars, locations, sessions, motionSettings, tombstones, aliases] = await Promise.all([
      db.drivers.toArray(),
      db.cars.toArray(),
      db.locations.toArray(),
      db.sessions.toArray(),
      db.motionSettings.toArray(),
      db.tombstones.toArray(),
      db.aliases.toArray(),
    ]);
    return {
      data: {
        drivers: drivers.map(withoutNameKey),
        cars: cars.map(withoutNameKey),
        locations: locations.map(withoutNameKey),
        sessions,
        motionSettings: motionSettings.map(withoutNameKey),
      },
      tombstones,
      aliases,
    };
  }

  const withNameKey = <T extends { name: string }>(record: T) => ({ ...record, nameKey: nameKey(record.name) });

  // Throws if another record already has this name (a record may keep its own name with different case or accents).
  function refuseTaken(taken: { id: string } | undefined, ownId: string | undefined, kind: EntityKind, name: string) {
    if (taken && taken.id !== ownId) throw new DataStoreError("duplicate", duplicateNameMessage(kind, name));
  }

  return {
    async loadSnapshot() {
      return read(async () => {
        const [drivers, cars, locations, sessions] = await Promise.all([
          db.drivers.toArray(),
          db.cars.toArray(),
          db.locations.toArray(),
          db.sessions.toArray(),
        ]);
        const carsByDriver = new Map<string, Car[]>();
        for (const row of cars.sort(byName)) {
          const list = carsByDriver.get(row.driverId) ?? [];
          list.push(withoutNameKey(row));
          carsByDriver.set(row.driverId, list);
        }
        return {
          drivers: drivers
            .sort(byName)
            .map((row): Driver => ({ ...withoutNameKey(row), cars: carsByDriver.get(row.id) ?? [] })),
          locations: locations.sort(byName).map((row): Location => withoutNameKey(row)),
          sessions: sessions as SessionRecord[],
        };
      });
    },

    async createDriver(input) {
      const name = checkedName(input, "driver");
      return change(async () => {
        const key = nameKey(name);
        refuseTaken(await db.drivers.where("nameKey").equals(key).first(), undefined, "driver", name);
        const at = now();
        const row: DriverRow = { id: newId(), name, nameKey: key, createdAt: at, updatedAt: at };
        await db.drivers.add(row);
        return { ...withoutNameKey(row), cars: [] };
      });
    },

    async renameDriver(id, input) {
      const name = checkedName(input, "driver");
      return change(async () => {
        if (!(await db.drivers.get(id))) throw new DataStoreError("not-found", "Driver not found");
        const key = nameKey(name);
        refuseTaken(await db.drivers.where("nameKey").equals(key).first(), id, "driver", name);
        await db.drivers.update(id, { name, nameKey: key, updatedAt: now() });
        // Sessions keep their updatedAt: it only changes with their notes (see src/domain/sync).
        await db.sessions.where("driverId").equals(id).modify({ driverName: name });
      });
    },

    async deleteDriver(id) {
      return change(async () => {
        if (!(await db.drivers.get(id))) return;
        const carIds = (await db.cars.where("driverId").equals(id).primaryKeys()) as string[];
        const sessionIds = new Set([
          ...(await sessionIdsWhere("driverId", [id])),
          ...(await sessionIdsWhere("carId", carIds)),
        ]);
        await deleteSessions([...sessionIds]);
        await bury("car", carIds);
        await db.cars.bulkDelete(carIds);
        await bury("driver", [id]);
        await db.drivers.delete(id);
      });
    },

    async createCar({ driverId, name: input, defaultCarNumber }) {
      const name = checkedName(input, "car");
      return change(async () => {
        if (!(await db.drivers.get(driverId))) throw new DataStoreError("invalid", `Driver ${driverId} not found`);
        const key = nameKey(name);
        const taken = await db.cars.where("[driverId+nameKey]").equals([driverId, key]).first();
        refuseTaken(taken, undefined, "car", name);
        const at = now();
        const row: CarRow = {
          id: newId(),
          name,
          nameKey: key,
          driverId,
          defaultCarNumber: cleanCarNumber(defaultCarNumber),
          createdAt: at,
          updatedAt: at,
        };
        await db.cars.add(row);
        return withoutNameKey(row);
      });
    },

    async updateCar(id, { name: input, defaultCarNumber }) {
      const name = checkedName(input, "car");
      return change(async () => {
        const car = await db.cars.get(id);
        if (!car) throw new DataStoreError("not-found", "Car not found");
        const key = nameKey(name);
        const taken = await db.cars.where("[driverId+nameKey]").equals([car.driverId, key]).first();
        refuseTaken(taken, id, "car", name);
        await db.cars.update(id, {
          name,
          nameKey: key,
          defaultCarNumber: cleanCarNumber(defaultCarNumber),
          updatedAt: now(),
        });
        await db.sessions.where("carId").equals(id).modify({ carName: name });
      });
    },

    async deleteCar(id) {
      return change(async () => {
        if (!(await db.cars.get(id))) return;
        await deleteSessions(await sessionIdsWhere("carId", [id]));
        await bury("car", [id]);
        await db.cars.delete(id);
      });
    },

    async createLocation(input) {
      const name = checkedName(input, "location");
      return change(async () => {
        const key = nameKey(name);
        refuseTaken(await db.locations.where("nameKey").equals(key).first(), undefined, "location", name);
        const at = now();
        const row: LocationRow = { id: newId(), name, nameKey: key, createdAt: at, updatedAt: at };
        await db.locations.add(row);
        return withoutNameKey(row);
      });
    },

    async renameLocation(id, input) {
      const name = checkedName(input, "location");
      return change(async () => {
        if (!(await db.locations.get(id))) throw new DataStoreError("not-found", "Location not found");
        const key = nameKey(name);
        refuseTaken(await db.locations.where("nameKey").equals(key).first(), id, "location", name);
        await db.locations.update(id, { name, nameKey: key, updatedAt: now() });
        await db.sessions.where("locationId").equals(id).modify({ locationName: name });
      });
    },

    async deleteLocation(id) {
      return change(async () => {
        if (!(await db.locations.get(id))) return;
        await deleteSessions(await sessionIdsWhere("locationId", [id]));
        await bury("location", [id]);
        await db.locations.delete(id);
      });
    },

    async saveSession(input) {
      const parsed = parseSessionInput(input);
      if (!parsed.ok) throw new DataStoreError("invalid", parsed.error);
      const session = parsed.session;
      return change(async () => {
        // A session that was saved, or saved and then deleted, isn't saved again: a retry must not bring it back.
        if ((await db.sessions.get(session.id)) || (await db.tombstones.get(["session", session.id]))) {
          return { created: false };
        }
        // A save waiting since before a restore may name a driver, car or location that was folded into another.
        const [driver, car, location] = await Promise.all([
          resolve("driver", session.driverId).then((id) => db.drivers.get(id)),
          resolve("car", session.carId).then((id) => db.cars.get(id)),
          resolve("location", session.locationId).then((id) => db.locations.get(id)),
        ]);
        if (!driver) throw new DataStoreError("invalid", `Driver ${session.driverId} not found`);
        if (!car || car.driverId !== driver.id) {
          throw new DataStoreError("invalid", `Car ${session.carId} not found for this driver`);
        }
        if (!location) throw new DataStoreError("invalid", `Location ${session.locationId} not found`);

        const laps = [...session.laps].sort((a, b) => a.lapNumber - b.lapNumber);
        const at = now();
        await db.sessions.add({
          id: session.id,
          date: session.date.toISOString(),
          driverId: driver.id,
          driverName: driver.name,
          carId: car.id,
          carName: car.name,
          locationId: location.id,
          locationName: location.name,
          laps,
          penalties: [...session.penalties].sort((a, b) => a.lapNumber - b.lapNumber),
          totalTime: laps.reduce((sum, lap) => sum + lap.lapTime, 0),
          totalLaps: laps.length,
          notes: null,
          createdAt: at,
          updatedAt: at,
        });
        return { created: true };
      });
    },

    async updateSessionNotes(id, input) {
      const notes = cleanNotes(input);
      if (!notes.ok) throw new DataStoreError("invalid", notes.error);
      return change(async () => {
        if (!(await db.sessions.get(id))) throw new DataStoreError("not-found", "Session not found");
        await db.sessions.update(id, { notes: notes.value, updatedAt: now() });
      });
    },

    async deleteSession(id) {
      return change(async () => {
        if (await db.sessions.get(id)) await deleteSessions([id]);
      });
    },

    async listMotionSettings() {
      return read(async () =>
        (await db.motionSettings.toArray()).sort(byName).map((row): MotionSettings => withoutNameKey(row)),
      );
    },

    async createMotionSettings(input) {
      const checked = checkMotionSettings(input);
      if (!checked.ok) throw new DataStoreError("invalid", `Invalid input data: ${checked.errors.join("; ")}`);
      const settings = checked.value;
      return change(async () => {
        const key = nameKey(settings.name);
        const taken = await db.motionSettings.where("nameKey").equals(key).first();
        refuseTaken(taken, undefined, "motionSetting", settings.name);
        const at = now();
        const row: MotionSettingsRow = { id: newId(), ...settings, nameKey: key, createdAt: at, updatedAt: at };
        await db.motionSettings.add(row);
        return withoutNameKey(row);
      });
    },

    async updateMotionSettings(id, input) {
      const checked = checkMotionSettings(input);
      if (!checked.ok) throw new DataStoreError("invalid", `Invalid input data: ${checked.errors.join("; ")}`);
      const settings = checked.value;
      return change(async () => {
        if (!(await db.motionSettings.get(id))) throw new DataStoreError("not-found", "Motion settings not found");
        const key = nameKey(settings.name);
        refuseTaken(await db.motionSettings.where("nameKey").equals(key).first(), id, "motionSetting", settings.name);
        await db.motionSettings.update(id, { ...settings, nameKey: key, updatedAt: now() });
      });
    },

    async deleteMotionSettings(id) {
      return change(async () => {
        if (!(await db.motionSettings.get(id))) return;
        await bury("motionSettings", [id]);
        await db.motionSettings.delete(id);
      });
    },

    async exportBundle(): Promise<Bundle> {
      return change(async () => {
        // Each phone names itself once, so merged data can tell where it came from.
        let deviceId = (await db.meta.get("deviceId"))?.value;
        if (!deviceId) {
          deviceId = newId();
          await db.meta.put({ key: "deviceId", value: deviceId });
        }
        return {
          format: BUNDLE_FORMAT,
          schemaVersion: BUNDLE_SCHEMA_VERSION,
          exportedAt: now(),
          deviceId,
          ...(await readContents()),
        };
      });
    },

    async importBundle(bundle, { dryRun = false } = {}) {
      // Read, merge and write in one transaction: the merge itself is plain code, so nothing else is awaited.
      return change(async () => {
        const before = await readContents();
        const { merged, summary } = mergeBundles(before, bundle, now());
        if (dryRun) return summary;
        const writes = planWrites(before, merged);
        // Deletes first, and changed records are written afresh, so a name that moves between records (even along a
        // chain of renames) is always free by the time it arrives in a unique index.
        const cleared = <T extends { id: string }>({ put, remove }: TableWrites<T>) => [
          ...remove,
          ...put.map((record) => record.id),
        ];
        await db.sessions.bulkDelete(writes.sessions.remove);
        await db.cars.bulkDelete(cleared(writes.cars));
        await db.drivers.bulkDelete(cleared(writes.drivers));
        await db.locations.bulkDelete(cleared(writes.locations));
        await db.motionSettings.bulkDelete(cleared(writes.motionSettings));
        await db.drivers.bulkPut(writes.drivers.put.map(withNameKey));
        await db.cars.bulkPut(writes.cars.put.map(withNameKey));
        await db.locations.bulkPut(writes.locations.put.map(withNameKey));
        await db.motionSettings.bulkPut(writes.motionSettings.put.map(withNameKey));
        await db.sessions.bulkPut(writes.sessions.put);
        await db.tombstones.bulkPut(writes.tombstones);
        await db.aliases.bulkPut(writes.aliases);
        return summary;
      });
    },

    async lastBackupAt() {
      return read(async () => (await db.meta.get("lastBackupAt"))?.value ?? null);
    },

    async markBackedUp(at) {
      return change(async () => {
        await db.meta.put({ key: "lastBackupAt", value: at });
      });
    },
  };
}
