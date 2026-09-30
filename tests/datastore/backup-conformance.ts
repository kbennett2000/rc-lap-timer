// The BackupStore contract as tests: saving the data as a backup file (src/domain/sync), and merging one back in.
// Every store that keeps its own data runs it: the phone's on-device store, and the Pi's API. Like the DataStore
// contract, it tags every name and uses fresh ids, so it can share a database with other tests.

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { BackupStore, DataStore } from "@/data/types";
import {
  BUNDLE_FORMAT,
  BUNDLE_SCHEMA_VERSION,
  EMPTY_CONTENTS,
  type Alias,
  type Bundle,
  type BundleData,
  type Tombstone,
} from "@/domain/sync/bundle";
import { hasChanges } from "@/domain/sync/merge";

type Store = DataStore & BackupStore;

const at = (minute: number) => new Date(Date.UTC(2026, 8, 1, 10, minute)).toISOString();

export function describeBackupStore(label: string, makeStore: () => Store | Promise<Store>) {
  describe(`BackupStore contract: ${label}`, () => {
    let store: Store;
    const tag = randomUUID().slice(0, 8);
    const named = (name: string) => `${name} ${tag}`;
    const made = { drivers: new Set<string>(), locations: new Set<string>(), motion: new Set<string>() };

    function bundle(contents: { data?: Partial<BundleData>; tombstones?: Tombstone[]; aliases?: Alias[] }): Bundle {
      return {
        format: BUNDLE_FORMAT,
        schemaVersion: BUNDLE_SCHEMA_VERSION,
        exportedAt: at(59),
        deviceId: randomUUID(),
        ...EMPTY_CONTENTS,
        ...contents,
        data: { ...EMPTY_CONTENTS.data, ...contents.data },
      };
    }

    // A driver with a car, a location, a session there, and a motion setting, none of which the store has yet.
    function newRecords(name: string) {
      const stamps = { createdAt: at(0), updatedAt: at(0) };
      const driver = { id: randomUUID(), name: named(name), ...stamps };
      const car = { id: randomUUID(), name: "Slash", driverId: driver.id, defaultCarNumber: 7, ...stamps };
      const location = { id: randomUUID(), name: named(`${name} Track`), ...stamps };
      const session = {
        id: randomUUID(),
        date: at(1),
        driverId: driver.id,
        driverName: driver.name,
        carId: car.id,
        carName: car.name,
        locationId: location.id,
        locationName: location.name,
        laps: [
          { lapNumber: 1, lapTime: 12000 },
          { lapNumber: 2, lapTime: 11500 },
        ],
        penalties: [{ lapNumber: 2, count: 1 }],
        totalTime: 23500,
        totalLaps: 2,
        notes: "Dusty",
        ...stamps,
      };
      const motion = {
        id: randomUUID(),
        name: named(`${name} Setting`),
        sensitivity: 60,
        threshold: 1.5,
        cooldown: 900,
        framesToSkip: 12,
        ...stamps,
      };
      made.drivers.add(driver.id);
      made.locations.add(location.id);
      made.motion.add(motion.id);
      const data = {
        drivers: [driver],
        cars: [car],
        locations: [location],
        sessions: [session],
        motionSettings: [motion],
      };
      return { driver, car, location, session, motion, data };
    }

    // The part of the store's backup that holds these records.
    async function exported(ids: string[]) {
      const backup = await store.exportBundle();
      const only = <T extends { id: string }>(records: T[]) => records.filter((r) => ids.includes(r.id));
      return {
        drivers: only(backup.data.drivers),
        cars: only(backup.data.cars),
        locations: only(backup.data.locations),
        sessions: only(backup.data.sessions),
        motionSettings: only(backup.data.motionSettings),
        tombstones: backup.tombstones.filter((t) => ids.includes(t.id)),
      };
    }
    const idsOf = (records: ReturnType<typeof newRecords>) =>
      [records.driver, records.car, records.location, records.session, records.motion].map((r) => r.id);

    beforeAll(async () => {
      store = await makeStore();
    });

    afterAll(async () => {
      if (!store) return;
      for (const id of made.drivers) await store.deleteDriver(id).catch(() => {});
      for (const id of made.locations) await store.deleteLocation(id).catch(() => {});
      for (const id of made.motion) await store.deleteMotionSettings(id).catch(() => {});
    });

    it("merges a backup in, and saves it back out exactly", async () => {
      const records = newRecords("Exact");
      const summary = await store.importBundle(JSON.parse(JSON.stringify(bundle({ data: records.data }))));
      for (const kind of ["driver", "car", "location", "session", "motionSettings"] as const) {
        expect(summary[kind].added, kind).toBe(1);
      }
      const saved = await exported(idsOf(records));
      expect(saved).toEqual({ ...records.data, tombstones: [] });
    });

    it("previews without writing, and a second merge changes nothing", async () => {
      const records = newRecords("Preview");
      const backup = bundle({ data: records.data });
      expect((await store.importBundle(backup, { dryRun: true })).driver.added).toBe(1);
      expect((await exported(idsOf(records))).drivers).toEqual([]);

      await store.importBundle(backup);
      expect(hasChanges(await store.importBundle(backup))).toBe(false);
      expect(hasChanges(await store.importBundle(await store.exportBundle()))).toBe(false);
    });

    it("takes newer names and notes, and the sessions follow the names", async () => {
      const records = newRecords("Newer");
      await store.importBundle(bundle({ data: records.data }));
      const driver = { ...records.driver, name: named("Newer Renamed"), updatedAt: at(5) };
      const session = { ...records.session, notes: "Wet", updatedAt: at(5) };
      const summary = await store.importBundle(
        bundle({ data: { ...records.data, drivers: [driver], sessions: [session] } }),
      );
      expect(summary.driver.updated).toBe(1);
      expect(summary.session.updated).toBe(1);
      const saved = await exported(idsOf(records));
      expect(saved.drivers).toEqual([driver]);
      expect(saved.sessions[0]).toMatchObject({ notes: "Wet", driverName: named("Newer Renamed"), updatedAt: at(5) });
    });

    it("renames records along a chain in one merge", async () => {
      // B gives up its name, and A takes it, in the same backup.
      const a = newRecords("Chain A");
      const b = newRecords("Chain B");
      await store.importBundle(bundle({ data: { drivers: [a.driver, b.driver] } }));
      const renamedB = { ...b.driver, name: named("Chain C"), updatedAt: at(5) };
      const renamedA = { ...a.driver, name: b.driver.name, updatedAt: at(5) };
      await store.importBundle(bundle({ data: { drivers: [renamedB, renamedA] } }));
      const saved = await exported([a.driver.id, b.driver.id]);
      expect(saved.drivers.map((d) => d.name).sort()).toEqual([b.driver.name, named("Chain C")].sort());
    });

    it("saves the tombstones a delete leaves, with everything it takes along", async () => {
      const records = newRecords("Buried");
      await store.importBundle(bundle({ data: records.data }));
      await store.deleteDriver(records.driver.id);
      const saved = await exported(idsOf(records));
      expect(saved.tombstones.map((t) => `${t.kind}:${t.id}`).sort()).toEqual(
        [`driver:${records.driver.id}`, `car:${records.car.id}`, `session:${records.session.id}`].sort(),
      );
      expect(saved.locations).toHaveLength(1);
    });

    it("deletes what a backup says was deleted, with everything it takes along", async () => {
      const records = newRecords("Deleted Elsewhere");
      await store.importBundle(bundle({ data: records.data }));
      const summary = await store.importBundle(
        bundle({ tombstones: [{ kind: "driver", id: records.driver.id, deletedAt: at(9) }] }),
      );
      expect(summary.driver.deleted).toBe(1);
      expect(summary.session.deleted).toBe(1);
      const saved = await exported(idsOf(records));
      expect([saved.drivers, saved.cars, saved.sessions]).toEqual([[], [], []]);
      expect(saved.locations).toHaveLength(1);
      // And it stays deleted.
      expect((await store.importBundle(bundle({ data: records.data }))).driver.added).toBe(0);
    });

    it("folds a record with the same name into the one it has", async () => {
      const driver = await store.createDriver(named("Folded"));
      made.drivers.add(driver.id);
      const records = newRecords("folded");
      const summary = await store.importBundle(bundle({ data: records.data }));
      expect(summary.driver.merged).toBe(1);
      const saved = await exported([driver.id, records.driver.id, records.session.id]);
      expect(saved.drivers.map((d) => d.id)).toEqual([driver.id]);
      expect(saved.sessions[0]).toMatchObject({ driverId: driver.id, driverName: named("Folded") });
    });

    it("moves its own records to the ids a backup's aliases give them, and saves late sessions there", async () => {
      // Another phone folded this store's driver, car and location into its own; restoring its backup moves them.
      const driver = await store.createDriver(named("Moved"));
      const car = await store.createCar({ driverId: driver.id, name: "Slash", defaultCarNumber: null });
      const location = await store.createLocation(named("Moved Track"));
      made.drivers.add(driver.id);
      made.locations.add(location.id);
      const records = newRecords("Moved");
      await store.importBundle(
        bundle({
          data: records.data,
          aliases: [
            { kind: "driver", fromId: driver.id, toId: records.driver.id },
            { kind: "car", fromId: car.id, toId: records.car.id },
            { kind: "location", fromId: location.id, toId: records.location.id },
          ],
        }),
      );
      const ids = [driver.id, records.driver.id];
      expect((await exported(ids)).drivers.map((d) => d.id)).toEqual([records.driver.id]);

      const late = {
        ...records.session,
        id: randomUUID(),
        driverId: driver.id,
        carId: car.id,
        locationId: location.id,
      };
      expect(await store.saveSession(late)).toEqual({ created: true });
      const saved = (await store.loadSnapshot()).sessions.find((s) => s.id === late.id);
      expect(saved).toMatchObject({
        driverId: records.driver.id,
        carId: records.car.id,
        locationId: records.location.id,
      });
    });

    it("names itself once, and remembers the last backup", async () => {
      const first = await store.exportBundle();
      expect((await store.exportBundle()).deviceId).toBe(first.deviceId);
      await store.markBackedUp(at(30));
      expect(await store.lastBackupAt()).toBe(at(30));
    });
  });
}
