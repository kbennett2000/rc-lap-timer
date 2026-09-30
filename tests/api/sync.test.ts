// Backups and sync on the timer (/api/sync), beyond the BackupStore contract (tests/datastore/backup-conformance.ts):
// what only the Pi has, like race results, and what only its routes do. Needs the running server described in
// api.test.ts.

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { BUNDLE_FORMAT, BUNDLE_SCHEMA_VERSION, EMPTY_CONTENTS, type Bundle } from "@/domain/sync/bundle";
import { BASE, addEntry, addRace, call, createCar, createDriver, createLocation, prisma } from "./helpers";

const RUN = Date.now().toString(36);
const named = (name: string) => `Sync ${name} ${RUN}`;

function bundle(contents: Partial<Pick<Bundle, "tombstones" | "aliases">> & { data?: Partial<Bundle["data"]> }) {
  return {
    format: BUNDLE_FORMAT,
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    deviceId: randomUUID(),
    ...EMPTY_CONTENTS,
    ...contents,
    data: { ...EMPTY_CONTENTS.data, ...contents.data },
  };
}

const merge = (backup: unknown, dryRun = false) => call("POST", "/api/sync", { bundle: backup, dryRun });

async function tombstone(kind: string, recordId: string) {
  return prisma.tombstone.findUnique({ where: { kind_recordId: { kind, recordId } } });
}

async function rowCounts() {
  const counts = await Promise.all([
    prisma.driver.count(),
    prisma.car.count(),
    prisma.location.count(),
    prisma.session.count(),
    prisma.lap.count(),
    prisma.motionSettings.count(),
    prisma.tombstone.count(),
    prisma.idAlias.count(),
  ]);
  return counts.join(",");
}

describe("the timer's sync routes", () => {
  it("say it's a timer, and which backup format it speaks", async () => {
    const { status, json } = await call("GET", "/api/sync/status");
    expect(status).toBe(200);
    expect(json).toMatchObject({ app: "rc-lap-timer", schemaVersion: BUNDLE_SCHEMA_VERSION });
    expect((await call("GET", "/api/sync")).json.deviceId).toBe(json.deviceId);
  });

  it("refuse a backup that isn't sent as JSON, or that's from a newer version", async () => {
    const text = await fetch(`${BASE}/api/sync`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ bundle: bundle({}) }),
    });
    expect(text.status).toBe(415);
    const newer = await merge({ ...bundle({}), schemaVersion: BUNDLE_SCHEMA_VERSION + 1 });
    expect(newer.status).toBe(400);
    expect(newer.json.error).toContain("newer version");
    expect((await merge({ hello: "there" })).status).toBe(400);
  });

  it("let the phone app's site read them, and refuse other sites' changes", async () => {
    // The server runs with SYNC_ALLOWED_ORIGINS including the phone app's real site (see api.test.ts).
    const app = "https://kbennett2000.github.io";
    const status = await fetch(`${BASE}/api/sync/status`, { headers: { Origin: app } });
    expect(status.headers.get("access-control-allow-origin")).toBe(app);

    const asked = await fetch(`${BASE}/api/sync`, {
      method: "OPTIONS",
      headers: {
        Origin: app,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    expect(asked.status).toBe(204);
    expect(asked.headers.get("access-control-allow-headers")).toBe("Content-Type");

    const other = await fetch(`${BASE}/api/sync`, {
      method: "POST",
      headers: { Origin: "https://example.com", "Content-Type": "application/json" },
      body: JSON.stringify({ bundle: bundle({}) }),
    });
    expect(other.status).toBe(403);
    expect(other.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("change nothing on a dry run", async () => {
    const at = new Date().toISOString();
    const driver = { id: randomUUID(), name: named("Dry"), createdAt: at, updatedAt: at };
    const before = await rowCounts();
    const { status, json } = await merge(bundle({ data: { drivers: [driver] } }), true);
    expect(status).toBe(200);
    expect(json.summary.driver.added).toBe(1);
    expect(await rowCounts()).toBe(before);
  });
});

describe("deletes on the timer", () => {
  it("leave a tombstone when a motion setting is deleted through its own route", async () => {
    const setting = { name: named("Setting"), sensitivity: 50, threshold: 1.5, cooldown: 1000, framesToSkip: 10 };
    const { json } = await call("POST", "/api/motion-settings", setting);
    expect((await call("DELETE", `/api/motion-settings?id=${json.id}`)).status).toBe(200);
    expect(await tombstone("motionSettings", json.id)).not.toBeNull();
  });

  it("take a driver's sessions along, even ones in another driver's car", async () => {
    // Old data, or a merge, can leave a session whose car belongs to someone else.
    const driverId = await createDriver(named("Borrower"));
    const ownerId = await createDriver(named("Owner"));
    const carId = await createCar(ownerId, "Lent");
    const locationId = await createLocation(named("Borrowed Track"));
    const sessionId = randomUUID();
    await prisma.session.create({
      data: {
        id: sessionId,
        date: new Date(),
        driverId,
        carId,
        locationId,
        driverName: "",
        carName: "",
        locationName: "",
        totalTime: 0,
        totalLaps: 0,
      },
    });
    expect((await call("DELETE", "/api/manage", { type: "driver", driverId })).status).toBe(200);
    expect(await prisma.session.findUnique({ where: { id: sessionId } })).toBeNull();
    expect(await tombstone("session", sessionId)).not.toBeNull();
    expect(await prisma.car.findUnique({ where: { id: carId } })).not.toBeNull();
  });
});

describe("merging into the timer", () => {
  it("moves race results and session requests with a driver, car and location merged into others", async () => {
    // A phone folded this timer's records into its own, and now sends its data here.
    const driverId = await createDriver(named("Racer"));
    const carId = await createCar(driverId, "Racer Car");
    const locationId = await createLocation(named("Race Track"));
    const { raceId, entryId } = await addRace(locationId, driverId, carId, 11);
    // Completed, so it doesn't show up as the next request in api.test.ts.
    const request = await prisma.sessionRequest.create({
      data: { driverId, carId, locationId, numberOfLaps: 5, status: "COMPLETED" },
    });

    const at = new Date().toISOString();
    const stamps = { createdAt: at, updatedAt: at };
    const driver = { id: randomUUID(), name: named("Racer"), ...stamps };
    const car = { id: randomUUID(), name: "Racer Car", driverId: driver.id, defaultCarNumber: null, ...stamps };
    const location = { id: randomUUID(), name: named("Race Track"), ...stamps };
    const { status, json } = await merge(
      bundle({
        data: { drivers: [driver], cars: [car], locations: [location] },
        aliases: [
          { kind: "driver", fromId: driverId, toId: driver.id },
          { kind: "car", fromId: carId, toId: car.id },
          { kind: "location", fromId: locationId, toId: location.id },
        ],
      }),
    );
    expect(status, JSON.stringify(json)).toBe(200);

    expect(await prisma.driver.findUnique({ where: { id: driverId } })).toBeNull();
    expect(await prisma.raceEntry.findUnique({ where: { id: entryId } })).toMatchObject({
      driverId: driver.id,
      carId: car.id,
    });
    expect(await prisma.race.findUnique({ where: { id: raceId } })).toMatchObject({ locationId: location.id });
    expect(await prisma.sessionRequest.findUnique({ where: { id: request.id } })).toMatchObject({
      driverId: driver.id,
      carId: car.id,
      locationId: location.id,
    });
  });

  it("keeps one entry per driver in a race when two drivers become one", async () => {
    const keptId = await createDriver(named("Kept"));
    const goneId = await createDriver(named("Gone"));
    const keptCar = await createCar(keptId, "Kept Car");
    const goneCar = await createCar(goneId, "Gone Car");
    const locationId = await createLocation(named("Shared Race"));
    const { raceId, entryId } = await addRace(locationId, keptId, keptCar, 21);
    const clash = await addEntry(raceId, goneId, goneCar, 22);

    const { status } = await merge(bundle({ aliases: [{ kind: "driver", fromId: goneId, toId: keptId }] }));
    expect(status).toBe(200);
    const entries = await prisma.raceEntry.findMany({ where: { raceId } });
    expect(entries.map((e) => e.id)).toEqual([entryId]);
    expect(await prisma.raceLap.count({ where: { raceEntryId: clash.id } })).toBe(0);
    // The merged driver's car now belongs to the driver it went into.
    expect(await prisma.car.findUnique({ where: { id: goneCar } })).toMatchObject({ driverId: keptId });
  });

  it("deletes a location's races along with it", async () => {
    const driverId = await createDriver(named("Visitor"));
    const carId = await createCar(driverId, "Visitor Car");
    const locationId = await createLocation(named("Closed Track"));
    const { raceId } = await addRace(locationId, driverId, carId, 31);

    const { status, json } = await merge(
      bundle({ tombstones: [{ kind: "location", id: locationId, deletedAt: new Date().toISOString() }] }),
    );
    expect(status).toBe(200);
    expect(json.summary.location.deleted).toBe(1);
    expect(await prisma.location.findUnique({ where: { id: locationId } })).toBeNull();
    expect(await prisma.race.findUnique({ where: { id: raceId } })).toBeNull();
    expect(await prisma.driver.findUnique({ where: { id: driverId } })).not.toBeNull();
  });
});

describe("the timer's clock (/api/sync/clock)", () => {
  const HOUR = 60 * 60_000;
  const tell = (now: unknown) => call("POST", "/api/sync/clock", { now });

  it("is left alone by a device whose clock is close or behind", async () => {
    expect((await tell(Date.now())).json).toEqual({ changed: false, reason: "close" });
    expect((await tell(Date.now() - HOUR)).json).toEqual({ changed: false, reason: "behind" });
  });

  it("isn't set during a race that started since boot", async () => {
    const locationId = await createLocation(named("Clock Track"));
    const race = await prisma.race.create({
      data: { name: "R", date: new Date(), locationId, status: "RACING", startDelay: 5 },
    });
    try {
      expect((await tell(Date.now() + HOUR)).json).toEqual({ changed: false, reason: "race" });
    } finally {
      await prisma.race.update({ where: { id: race.id }, data: { status: "FINISHED" } });
    }
  });

  it("is set by the helper, which this test server doesn't have", async () => {
    expect((await tell(Date.now() + HOUR)).json).toEqual({ changed: false, reason: "unavailable" });
  });

  it("takes only a time in milliseconds, as JSON, from the timer's pages or the phone app", async () => {
    for (const now of ["2026-09-30", null, Date.now() / 1000, Date.UTC(2100, 0, 1)]) {
      expect((await tell(now)).status).toBe(400);
    }
    const asText = await fetch(`${BASE}/api/sync/clock`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ now: Date.now() }),
    });
    expect(asText.status).toBe(415);

    const app = "https://kbennett2000.github.io";
    const asked = await fetch(`${BASE}/api/sync/clock`, {
      method: "OPTIONS",
      headers: {
        Origin: app,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    expect(asked.status).toBe(204);
    const fromApp = await fetch(`${BASE}/api/sync/clock`, {
      method: "POST",
      headers: { Origin: app, "Content-Type": "application/json" },
      body: JSON.stringify({ now: Date.now() }),
    });
    expect(fromApp.headers.get("access-control-allow-origin")).toBe(app);
    expect(await fromApp.json()).toEqual({ changed: false, reason: "close" });

    const other = await fetch(`${BASE}/api/sync/clock`, {
      method: "POST",
      headers: { Origin: "https://example.com", "Content-Type": "application/json" },
      body: JSON.stringify({ now: Date.now() + HOUR }),
    });
    expect(other.status).toBe(403);
  });
});
