import { randomUUID } from "node:crypto";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { LapTimerDB } from "@/data/local/db";
import { createLocalDataStore } from "@/data/local/local-data-store";
import type { Bundle } from "@/domain/sync/bundle";
import { hasChanges } from "@/domain/sync/merge";
import { CloudError } from "./errors";
import { syncWithCloud, type CloudBundleStore, type SavedBundle } from "./sync";

const newStore = () => createLocalDataStore(new LapTimerDB({ indexedDB: new IDBFactory(), IDBKeyRange }));
type Store = ReturnType<typeof newStore>;

// An account's bundle, kept as the database keeps it: as JSON, saved only from the version it's at.
interface FakeCloud extends CloudBundleStore {
  saved: SavedBundle | null;
  writes: number;
}

function fakeCloud(saved: SavedBundle | null = null): FakeCloud {
  const cloud: FakeCloud = {
    saved,
    writes: 0,
    async read() {
      return cloud.saved && { bundle: JSON.parse(JSON.stringify(cloud.saved.bundle)), version: cloud.saved.version };
    },
    async write(bundle, version) {
      if (version !== (cloud.saved?.version ?? 0)) return "conflict";
      cloud.writes++;
      cloud.saved = { bundle: JSON.parse(JSON.stringify(bundle)), version: version + 1 };
      return version + 1;
    },
  };
  return cloud;
}

async function addSession(store: Store, driverName: string) {
  const driver = await store.createDriver(driverName);
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
    laps: [{ lapNumber: 1, lapTime: 12000 }],
    penalties: [],
  };
  await store.saveSession(session);
  return { driver, car, location, session };
}

const everything = async (store: Store) => {
  const { drivers, locations, sessions } = await store.loadSnapshot();
  return { drivers, locations, sessions, motionSettings: await store.listMotionSettings() };
};

describe("syncing with the account in the cloud", () => {
  it("saves this phone's data the first time", async () => {
    const phone = newStore();
    await addSession(phone, "Amy");
    const cloud = fakeCloud();
    const result = await syncWithCloud(phone, cloud);
    expect(result.cloud.session.added).toBe(1);
    expect(hasChanges(result.phone)).toBe(false);
    expect(cloud.saved?.version).toBe(1);

    const restored = newStore();
    await restored.importBundle(cloud.saved!.bundle as Bundle);
    expect(await everything(restored)).toEqual(await everything(phone));
  });

  it("gives every phone on the account the same data, folding records with the same name", async () => {
    const first = newStore();
    const second = newStore();
    const cloud = fakeCloud();
    const amy = await addSession(first, "Amy");
    await addSession(second, "amy");
    await second.createDriver("Bob");

    await syncWithCloud(first, cloud);
    const result = await syncWithCloud(second, cloud);
    expect(result.cloud.driver).toMatchObject({ added: 1, merged: 1 });
    expect(result.phone.session.added).toBe(1);
    await syncWithCloud(first, cloud);

    expect(await everything(first)).toEqual(await everything(second));
    // The first phone saved Amy first, so the second phone's "amy" folds into that record.
    expect((await second.loadSnapshot()).drivers.map((d) => d.id)).toContain(amy.driver.id);
  });

  it("carries deletes", async () => {
    const first = newStore();
    const second = newStore();
    const cloud = fakeCloud();
    const { session } = await addSession(first, "Amy");
    await syncWithCloud(first, cloud);
    await syncWithCloud(second, cloud);

    await second.deleteSession(session.id);
    await syncWithCloud(second, cloud);
    const result = await syncWithCloud(first, cloud);
    expect(result.phone.session.deleted).toBe(1);
    expect((await first.loadSnapshot()).sessions).toEqual([]);
  });

  it("saves nothing when nothing changed", async () => {
    const phone = newStore();
    await addSession(phone, "Amy");
    const cloud = fakeCloud();
    await syncWithCloud(phone, cloud);
    const again = await syncWithCloud(phone, cloud);
    expect(hasChanges(again.cloud)).toBe(false);
    expect(hasChanges(again.phone)).toBe(false);
    expect(cloud.writes).toBe(1);
  });

  it("saves nothing for an empty phone and an empty account", async () => {
    const cloud = fakeCloud();
    await syncWithCloud(newStore(), cloud);
    expect(cloud.saved).toBeNull();
  });

  it("starts again when another phone saves first, keeping that phone's data", async () => {
    const phone = newStore();
    const other = newStore();
    await addSession(phone, "Amy");
    await addSession(other, "Bob");
    const cloud = fakeCloud();
    // The other phone syncs between this phone's first read and its save.
    const { read, write } = cloud;
    let reads = 0;
    cloud.read = async () => {
      const saved = await read();
      if (++reads === 1) await syncWithCloud(other, { read, write });
      return saved;
    };

    const result = await syncWithCloud(phone, cloud);
    expect(reads).toBe(2);
    expect(result.phone.driver.added).toBe(1);
    expect(cloud.saved?.version).toBe(2);
    expect((await phone.loadSnapshot()).drivers.map((d) => d.name).sort()).toEqual(["Amy", "Bob"]);
  });

  it("gives up after three tries in a row lose to another phone", async () => {
    const phone = newStore();
    await addSession(phone, "Amy");
    const cloud = fakeCloud();
    cloud.write = async () => "conflict";
    await expect(syncWithCloud(phone, cloud)).rejects.toMatchObject({ problem: "busy" });
    expect((await phone.loadSnapshot()).drivers).toHaveLength(1);
  });

  it("refuses data saved by a newer version of the app, and changes nothing", async () => {
    const phone = newStore();
    await addSession(phone, "Amy");
    const cloud = fakeCloud({ bundle: { format: "rc-lap-timer", schemaVersion: 2, data: {} }, version: 4 });
    const failure = syncWithCloud(phone, cloud);
    await expect(failure).rejects.toBeInstanceOf(CloudError);
    await expect(failure).rejects.toMatchObject({ problem: "update-app" });
    expect(cloud.writes).toBe(0);
  });

  it("refuses data it can't read, and leaves the phone alone", async () => {
    const phone = newStore();
    await addSession(phone, "Amy");
    const before = await everything(phone);
    const cloud = fakeCloud({ bundle: { something: "else" }, version: 1 });
    await expect(syncWithCloud(phone, cloud)).rejects.toMatchObject({ problem: "invalid" });
    expect(cloud.writes).toBe(0);
    expect(await everything(phone)).toEqual(before);
  });
});
