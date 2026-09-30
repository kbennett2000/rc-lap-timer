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

  it("doesn't bring back a deleted session when its save is retried", async () => {
    const { store, session } = await setUp();
    await store.deleteSession(session.id);
    expect(await store.saveSession(session)).toEqual({ created: false });
    expect((await store.loadSnapshot()).sessions).toEqual([]);
  });

  it("treats names that differ only in accents as the same", async () => {
    const store = createLocalDataStore(freshDb());
    await store.createDriver("José");
    await expect(store.createDriver("jose")).rejects.toMatchObject({ kind: "duplicate" });
  });

  it("keeps a session's updatedAt when names change, so only notes move it", async () => {
    const { store, driver, session } = await setUp();
    const before = (await store.loadSnapshot()).sessions[0].updatedAt;
    await new Promise((resolve) => setTimeout(resolve, 5));
    await store.renameDriver(driver.id, "Amelia");
    const renamed = (await store.loadSnapshot()).sessions[0];
    expect(renamed).toMatchObject({ id: session.id, driverName: "Amelia", updatedAt: before });
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
