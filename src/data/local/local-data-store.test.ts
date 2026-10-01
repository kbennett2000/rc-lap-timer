import { randomUUID } from "node:crypto";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { describeBackupStore } from "../../../tests/datastore/backup-conformance";
import { describeDataStore } from "../../../tests/datastore/conformance";
import { LapTimerDB } from "./db";
import { createLocalDataStore } from "./local-data-store";

// Each database gets its own in-memory IndexedDB.
const freshDb = (indexedDB = new IDBFactory()) => new LapTimerDB({ indexedDB, IDBKeyRange });

describeDataStore("the phone's on-device store", () => createLocalDataStore(freshDb()));
describeBackupStore("the phone's on-device store", () => createLocalDataStore(freshDb()));

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

describe("counting changes, for cloud sync", () => {
  it("counts each change to the data", async () => {
    const store = createLocalDataStore(freshDb());
    expect(await store.changeCount()).toBe(0);
    const driver = await store.createDriver("Amy");
    await store.renameDriver(driver.id, "Amelia");
    expect(await store.changeCount()).toBe(2);
    await store.deleteDriver(driver.id);
    expect(await store.changeCount()).toBe(3);
  });

  it("doesn't count a change that failed, or bookkeeping", async () => {
    const { store } = await setUp();
    const before = await store.changeCount();
    await expect(store.createDriver("amy")).rejects.toMatchObject({ kind: "duplicate" });
    await store.exportBundle();
    await store.markBackedUp("2026-10-01T00:00:00.000Z");
    expect(await store.changeCount()).toBe(before);
  });

  it("counts a restore or sync that changed something, and not one that didn't", async () => {
    const { store } = await setUp();
    const other = createLocalDataStore(freshDb());
    await other.createDriver("Bob");
    const bundle = await other.exportBundle();

    const before = await store.changeCount();
    await store.importBundle(bundle, { dryRun: true });
    expect(await store.changeCount(), "a dry run").toBe(before);
    await store.importBundle(bundle);
    expect(await store.changeCount()).toBe(before + 1);
    await store.importBundle(bundle);
    expect(await store.changeCount(), "nothing new the second time").toBe(before + 1);
  });
});

describe("the phone's on-device store", () => {
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
});
