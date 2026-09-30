// The DataStore contract as tests. Every store must pass it: tests/api/datastore.test.ts runs it against the Pi's
// API, and the phone's on-device store runs it too. It only uses the DataStore interface, names everything it
// creates with a per-run tag so it can share a database with other tests, and deletes what it made.

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DataStoreError, type DataErrorKind, type DataStore } from "@/data/types";
import { isUuid } from "@/domain/rules";
import type { NewSession, SessionRecord } from "@/domain/types";

const motion = { sensitivity: 50, threshold: 1.5, cooldown: 1000, framesToSkip: 10 };

async function expectError(promise: Promise<unknown>, kind: DataErrorKind) {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error, `expected a DataStoreError (${kind})`).toBeInstanceOf(DataStoreError);
  expect((error as DataStoreError).kind).toBe(kind);
  expect((error as DataStoreError).message).not.toBe("");
}

export function describeDataStore(label: string, makeStore: () => DataStore | Promise<DataStore>) {
  describe(`DataStore contract: ${label}`, () => {
    let store: DataStore;
    const tag = randomUUID().slice(0, 8);
    const named = (name: string) => `${name} ${tag}`;
    const made = { drivers: new Set<string>(), locations: new Set<string>(), motion: new Set<string>() };

    const snapshot = () => store.loadSnapshot();
    const findSession = async (id: string) => (await snapshot()).sessions.find((s) => s.id === id);

    async function newDriver(name: string) {
      const driver = await store.createDriver(named(name));
      made.drivers.add(driver.id);
      return driver;
    }
    async function newLocation(name: string) {
      const location = await store.createLocation(named(name));
      made.locations.add(location.id);
      return location;
    }
    // A driver with one car, and a location: enough to save sessions.
    async function newSetup(name: string) {
      const driver = await newDriver(name);
      const car = await store.createCar({ driverId: driver.id, name: "Car", defaultCarNumber: null });
      const location = await newLocation(`${name} Track`);
      return { driver, car, location };
    }
    function sessionFor(setup: Awaited<ReturnType<typeof newSetup>>, overrides: Partial<NewSession> = {}): NewSession {
      return {
        id: randomUUID(),
        date: "2026-09-30T12:00:00.000Z",
        driverId: setup.driver.id,
        driverName: "name from the client",
        carId: setup.car.id,
        carName: "name from the client",
        locationId: setup.location.id,
        locationName: "name from the client",
        laps: [
          { lapNumber: 2, lapTime: 11000 },
          { lapNumber: 1, lapTime: 12345.6 },
        ],
        penalties: [{ lapNumber: 2, count: 1 }],
        ...overrides,
      };
    }

    beforeAll(async () => {
      store = await makeStore();
    });

    afterAll(async () => {
      if (!store) return;
      for (const id of made.drivers) await store.deleteDriver(id).catch(() => {});
      for (const id of made.locations) await store.deleteLocation(id).catch(() => {});
      for (const id of made.motion) await store.deleteMotionSettings(id).catch(() => {});
    });

    describe("drivers, cars and locations", () => {
      it("creates a driver with no cars, trimming the name", async () => {
        const driver = await store.createDriver(`  ${named("Amy")}  `);
        made.drivers.add(driver.id);
        expect(driver).toMatchObject({ name: named("Amy"), cars: [] });
        expect(isUuid(driver.id)).toBe(true);
        expect(driver.createdAt).toBeTruthy();
        expect((await snapshot()).drivers.find((d) => d.id === driver.id)).toEqual(driver);
      });

      it("refuses an empty name, a name over 191 characters, and a name in use (ignoring case)", async () => {
        await expectError(store.createDriver("   "), "invalid");
        await expectError(store.createLocation("x".repeat(192)), "invalid");
        await expectError(store.createDriver(named("AMY")), "duplicate");
      });

      it("keeps car names unique per driver only", async () => {
        const one = await newDriver("Car Owner One");
        const two = await newDriver("Car Owner Two");
        const car = await store.createCar({ driverId: one.id, name: " Slash ", defaultCarNumber: 7 });
        expect(car).toMatchObject({ name: "Slash", driverId: one.id, defaultCarNumber: 7 });
        await expectError(store.createCar({ driverId: one.id, name: "slash", defaultCarNumber: null }), "duplicate");
        await store.createCar({ driverId: two.id, name: "Slash", defaultCarNumber: null });

        const drivers = (await snapshot()).drivers;
        expect(drivers.find((d) => d.id === one.id)?.cars).toEqual([car]);
        expect(drivers.find((d) => d.id === two.id)?.cars.map((c) => c.name)).toEqual(["Slash"]);
      });

      it("refuses a car for a driver that doesn't exist", async () => {
        await expectError(
          store.createCar({ driverId: randomUUID(), name: "Stray", defaultCarNumber: null }),
          "invalid",
        );
      });

      it("lists drivers, cars and locations by name", async () => {
        const driver = await newDriver("Sorting");
        for (const name of ["Bravo", "alpha", "Charlie"]) {
          await store.createCar({ driverId: driver.id, name, defaultCarNumber: null });
        }
        const { drivers, locations } = await snapshot();
        const byName = (names: string[]) => [...names].sort((a, b) => a.localeCompare(b));
        expect(drivers.find((d) => d.id === driver.id)?.cars.map((c) => c.name)).toEqual(["alpha", "Bravo", "Charlie"]);
        expect(drivers.map((d) => d.name)).toEqual(byName(drivers.map((d) => d.name)));
        expect(locations.map((l) => l.name)).toEqual(byName(locations.map((l) => l.name)));
      });

      it("renames drivers, cars and locations, and their saved sessions follow", async () => {
        const setup = await newSetup("Renames");
        const session = sessionFor(setup);
        await store.saveSession(session);

        await store.renameDriver(setup.driver.id, named("Renamed Driver"));
        await store.updateCar(setup.car.id, { name: "Renamed Car", defaultCarNumber: 5 });
        await store.renameLocation(setup.location.id, named("Renamed Track"));

        const { drivers, locations, sessions } = await snapshot();
        const driver = drivers.find((d) => d.id === setup.driver.id);
        expect(driver?.name).toBe(named("Renamed Driver"));
        expect(driver?.cars[0]).toMatchObject({ name: "Renamed Car", defaultCarNumber: 5 });
        expect(locations.find((l) => l.id === setup.location.id)?.name).toBe(named("Renamed Track"));
        expect(sessions.find((s) => s.id === session.id)).toMatchObject({
          driverName: named("Renamed Driver"),
          carName: "Renamed Car",
          locationName: named("Renamed Track"),
        });
      });

      it("clears a car's number with null", async () => {
        const setup = await newSetup("Numbers");
        await store.updateCar(setup.car.id, { name: "Car", defaultCarNumber: 9 });
        await store.updateCar(setup.car.id, { name: "Car", defaultCarNumber: null });
        const driver = (await snapshot()).drivers.find((d) => d.id === setup.driver.id);
        expect(driver?.cars[0].defaultCarNumber).toBeNull();
      });

      it("refuses a rename to a name in use, and to an empty name", async () => {
        const taken = await newDriver("Taken");
        const other = await newDriver("Other");
        await expectError(store.renameDriver(other.id, taken.name.toUpperCase()), "duplicate");
        await expectError(store.renameDriver(other.id, " "), "invalid");
        // Changing only the case of your own name is fine.
        await store.renameDriver(other.id, other.name.toUpperCase());
      });

      it("reports a rename of a record that doesn't exist", async () => {
        await expectError(store.renameDriver(randomUUID(), named("Ghost")), "not-found");
        await expectError(store.updateCar(randomUUID(), { name: "Ghost", defaultCarNumber: null }), "not-found");
        await expectError(store.renameLocation(randomUUID(), named("Ghost")), "not-found");
      });
    });

    describe("sessions", () => {
      it("saves a session once, filling in names, totals and lap order", async () => {
        const setup = await newSetup("Sessions");
        const session = sessionFor(setup);
        expect(await store.saveSession(session)).toEqual({ created: true });
        expect(await store.saveSession(session)).toEqual({ created: false });

        const saved = await findSession(session.id);
        expect(saved).toMatchObject<Partial<SessionRecord>>({
          id: session.id,
          date: session.date,
          driverName: setup.driver.name,
          carName: "Car",
          locationName: setup.location.name,
          laps: [
            { lapNumber: 1, lapTime: 12346 },
            { lapNumber: 2, lapTime: 11000 },
          ],
          penalties: [{ lapNumber: 2, count: 1 }],
          totalTime: 23346,
          totalLaps: 2,
          notes: null,
        });
        expect((await snapshot()).sessions.filter((s) => s.id === session.id)).toHaveLength(1);
      });

      it("refuses a session whose driver, car or location doesn't exist", async () => {
        const setup = await newSetup("Orphans");
        await expectError(store.saveSession(sessionFor(setup, { driverId: randomUUID() })), "invalid");
        await expectError(store.saveSession(sessionFor(setup, { locationId: randomUUID() })), "invalid");
        await expectError(store.saveSession(sessionFor(setup, { laps: [{ lapNumber: 1, lapTime: -1 }] })), "invalid");
      });

      it("sets and clears notes", async () => {
        const setup = await newSetup("Notes");
        const session = sessionFor(setup);
        await store.saveSession(session);
        await store.updateSessionNotes(session.id, "Loose rear wheel");
        expect((await findSession(session.id))?.notes).toBe("Loose rear wheel");
        await store.updateSessionNotes(session.id, "");
        expect((await findSession(session.id))?.notes).toBeNull();
        await expectError(store.updateSessionNotes(randomUUID(), "x"), "not-found");
      });

      it("doesn't bring back a deleted session when its save is retried", async () => {
        const setup = await newSetup("Retries");
        const session = sessionFor(setup);
        await store.saveSession(session);
        await store.deleteSession(session.id);
        expect(await store.saveSession(session)).toEqual({ created: false });
        expect(await findSession(session.id)).toBeUndefined();
      });

      // Sync keeps the more recent notes by updatedAt (src/domain/sync/merge.ts), so nothing else may move it.
      it("keeps a session's updatedAt when names change: only notes move it", async () => {
        const setup = await newSetup("Stamps");
        const session = sessionFor(setup);
        await store.saveSession(session);
        const saved = (await findSession(session.id))?.updatedAt;
        await new Promise((resolve) => setTimeout(resolve, 20));

        await store.renameDriver(setup.driver.id, named("Stamps Renamed"));
        await store.updateCar(setup.car.id, { name: "Renamed Car", defaultCarNumber: null });
        await store.renameLocation(setup.location.id, named("Stamps Track Renamed"));
        expect(await findSession(session.id)).toMatchObject({
          driverName: named("Stamps Renamed"),
          carName: "Renamed Car",
          updatedAt: saved,
        });

        await store.updateSessionNotes(session.id, "Now it moves");
        expect((await findSession(session.id))?.updatedAt).not.toBe(saved);
      });

      it("deletes a session, and deleting it again is a no-op", async () => {
        const setup = await newSetup("Deletes");
        const session = sessionFor(setup);
        await store.saveSession(session);
        await store.deleteSession(session.id);
        await store.deleteSession(session.id);
        expect(await findSession(session.id)).toBeUndefined();
      });
    });

    describe("cascading deletes", () => {
      it("deleting a car deletes its sessions, not the driver's other cars'", async () => {
        const setup = await newSetup("Car Cascade");
        const spare = await store.createCar({ driverId: setup.driver.id, name: "Spare", defaultCarNumber: null });
        const gone = sessionFor(setup);
        const kept = sessionFor({ ...setup, car: spare });
        await store.saveSession(gone);
        await store.saveSession(kept);

        await store.deleteCar(setup.car.id);
        const { drivers, sessions } = await snapshot();
        expect(drivers.find((d) => d.id === setup.driver.id)?.cars.map((c) => c.id)).toEqual([spare.id]);
        expect(sessions.map((s) => s.id)).not.toContain(gone.id);
        expect(sessions.map((s) => s.id)).toContain(kept.id);
      });

      it("deleting a location deletes its sessions, and keeps the drivers", async () => {
        const setup = await newSetup("Location Cascade");
        const session = sessionFor(setup);
        await store.saveSession(session);

        await store.deleteLocation(setup.location.id);
        const { drivers, locations, sessions } = await snapshot();
        expect(locations.map((l) => l.id)).not.toContain(setup.location.id);
        expect(sessions.map((s) => s.id)).not.toContain(session.id);
        expect(drivers.map((d) => d.id)).toContain(setup.driver.id);
      });

      it("deleting a driver deletes their cars and sessions", async () => {
        const setup = await newSetup("Driver Cascade");
        const session = sessionFor(setup);
        await store.saveSession(session);

        await store.deleteDriver(setup.driver.id);
        const { drivers, sessions } = await snapshot();
        expect(drivers.map((d) => d.id)).not.toContain(setup.driver.id);
        expect(sessions.map((s) => s.id)).not.toContain(session.id);
      });

      it("deleting something that's already gone is a no-op", async () => {
        await store.deleteDriver(randomUUID());
        await store.deleteCar(randomUUID());
        await store.deleteLocation(randomUUID());
        await store.deleteMotionSettings(randomUUID());
      });
    });

    describe("motion settings", () => {
      it("creates, lists, updates and deletes settings", async () => {
        const created = await store.createMotionSettings({ name: ` ${named("Sunny")} `, ...motion });
        made.motion.add(created.id);
        expect(created).toMatchObject({ name: named("Sunny"), ...motion });
        expect(isUuid(created.id)).toBe(true);
        expect(await store.listMotionSettings()).toContainEqual(created);

        await store.updateMotionSettings(created.id, { name: named("Cloudy"), ...motion, sensitivity: 80 });
        const updated = (await store.listMotionSettings()).find((m) => m.id === created.id);
        expect(updated).toMatchObject({ name: named("Cloudy"), sensitivity: 80 });

        await store.deleteMotionSettings(created.id);
        expect((await store.listMotionSettings()).map((m) => m.id)).not.toContain(created.id);
      });

      it("refuses settings out of range, names in use, and updates of missing settings", async () => {
        const taken = await store.createMotionSettings({ name: named("Taken Setting"), ...motion });
        made.motion.add(taken.id);
        await expectError(store.createMotionSettings({ name: named("taken setting"), ...motion }), "duplicate");
        await expectError(
          store.createMotionSettings({ name: named("Too Keen"), ...motion, sensitivity: 1 }),
          "invalid",
        );
        await expectError(store.updateMotionSettings(randomUUID(), { name: named("Ghost"), ...motion }), "not-found");
      });
    });
  });
}
