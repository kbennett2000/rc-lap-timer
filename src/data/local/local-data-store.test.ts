import { randomUUID } from "node:crypto";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { describeDataStore } from "../../../tests/datastore/conformance";
import { LapTimerDB } from "./db";
import { createLocalDataStore } from "./local-data-store";

// Each database gets its own in-memory IndexedDB.
const freshDb = (indexedDB = new IDBFactory()) => new LapTimerDB({ indexedDB, IDBKeyRange });

describeDataStore("the phone's on-device store", () => createLocalDataStore(freshDb()));

async function setUp(store = createLocalDataStore(freshDb())) {
  const driver = await store.createDriver("Amy");
  const car = await store.createCar({ driverId: driver.id, name: "Slash", defaultCarNumber: null });
  const location = await store.createLocation("Backyard");
  const session = {
    id: randomUUID(),
    date: "2026-09-30T12:00:00.000Z",
    driverId: driver.id,
    driverName: "",
    carId: car.id,
    carName: "",
    locationId: location.id,
    locationName: "",
    laps: [{ lapNumber: 1, lapTime: 1000 }],
    penalties: [],
  };
  await store.saveSession(session);
  return { store, driver, car, location, session };
}

describe("the phone's on-device store", () => {
  it("leaves tombstones for a delete and everything it cascades to", async () => {
    const db = freshDb();
    const { store, driver, car, session } = await setUp(createLocalDataStore(db));
    await store.deleteDriver(driver.id);
    const tombstones = await db.tombstones.toArray();
    expect(tombstones.map(({ kind, id }) => [kind, id]).sort()).toEqual(
      [
        ["car", car.id],
        ["driver", driver.id],
        ["session", session.id],
      ].sort(),
    );
  });

  it("treats names that differ only in accents as the same", async () => {
    const store = createLocalDataStore(freshDb());
    await store.createDriver("José");
    await expect(store.createDriver("jose")).rejects.toMatchObject({ kind: "duplicate" });
  });

  it("returns records without their name keys", async () => {
    const { store } = await setUp();
    await store.createMotionSettings({ name: "Sunny", sensitivity: 50, threshold: 1, cooldown: 500, framesToSkip: 10 });
    const { drivers, locations } = await store.loadSnapshot();
    const records = [
      ...drivers,
      ...drivers.flatMap((d) => d.cars),
      ...locations,
      ...(await store.listMotionSettings()),
    ];
    for (const record of records) expect(record).not.toHaveProperty("nameKey");
  });

  it("keeps its data when the app is closed and opened again", async () => {
    const indexedDB = new IDBFactory();
    const db = freshDb(indexedDB);
    const { session } = await setUp(createLocalDataStore(db));
    db.close();
    const reopened = createLocalDataStore(freshDb(indexedDB));
    expect((await reopened.loadSnapshot()).sessions.map((s) => s.id)).toEqual([session.id]);
  });

  it("reports storage that can't be opened as unavailable", async () => {
    const db = freshDb();
    db.close({ disableAutoOpen: true });
    await expect(createLocalDataStore(db).loadSnapshot()).rejects.toMatchObject({ kind: "unavailable" });
  });
});

describe("backups on the phone", () => {
  it("restores a backup into a fresh app exactly", async () => {
    const { store } = await setUp();
    await store.createMotionSettings({ name: "Sunny", sensitivity: 50, threshold: 1, cooldown: 500, framesToSkip: 10 });
    const bundle = JSON.parse(JSON.stringify(await store.exportBundle()));

    const fresh = createLocalDataStore(freshDb());
    const summary = await fresh.importBundle(bundle);
    expect(summary.session.added).toBe(1);
    expect(await fresh.loadSnapshot()).toEqual(await store.loadSnapshot());
    expect(await fresh.listMotionSettings()).toEqual(await store.listMotionSettings());
  });

  it("previews without writing, and a second restore changes nothing", async () => {
    const { store } = await setUp();
    const bundle = await store.exportBundle();
    const fresh = createLocalDataStore(freshDb());

    expect((await fresh.importBundle(bundle, { dryRun: true })).driver.added).toBe(1);
    expect((await fresh.loadSnapshot()).drivers).toEqual([]);

    await fresh.importBundle(bundle);
    const again = await fresh.importBundle(bundle);
    expect(Object.values(again).every((kind) => kind.added + kind.updated + kind.merged + kind.deleted === 0)).toBe(
      true,
    );
  });

  it("names itself once, and remembers the last backup", async () => {
    const store = createLocalDataStore(freshDb());
    const first = await store.exportBundle();
    expect((await store.exportBundle()).deviceId).toBe(first.deviceId);
    expect(await store.lastBackupAt()).toBeNull();
    await store.markBackedUp("2026-09-30T12:00:00.000Z");
    expect(await store.lastBackupAt()).toBe("2026-09-30T12:00:00.000Z");
  });

  it("saves a waiting session for records a restore moved to other ids", async () => {
    // Another phone folded this phone's Amy, Slash and Backyard into its own; restoring its backup moves them here too.
    const { store, driver, car, location, session } = await setUp();
    const other = await setUp();
    const bundle = await other.store.exportBundle();
    bundle.aliases = [
      { kind: "driver", fromId: driver.id, toId: other.driver.id },
      { kind: "car", fromId: car.id, toId: other.car.id },
      { kind: "location", fromId: location.id, toId: other.location.id },
    ];
    await store.importBundle(bundle);
    expect((await store.loadSnapshot()).drivers.map((d) => d.id)).toEqual([other.driver.id]);

    const pending = { ...session, id: randomUUID() };
    expect(await store.saveSession(pending)).toEqual({ created: true });
    const saved = (await store.loadSnapshot()).sessions.find((s) => s.id === pending.id);
    expect(saved).toMatchObject({ driverId: other.driver.id, carId: other.car.id, locationId: other.location.id });
  });
});
