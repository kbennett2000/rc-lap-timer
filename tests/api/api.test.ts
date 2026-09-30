// API tests against a running server and its database. They lock in the Phase 0 fixes: sessions saved once
// and idempotently, deletes that stick, renames that reach saved sessions, race-aware cascades, and the
// hardened System Settings endpoint.
//
// Run locally (CI does the same, see .github/workflows/ci.yml):
//   docker run -d --name rclt-mariadb -e MARIADB_ROOT_PASSWORD=devpass -e MARIADB_DATABASE=rc_lap_timer \
//     -p 127.0.0.1:3307:3306 mariadb:10.11
//   export DATABASE_URL="mysql://root:devpass@127.0.0.1:3307/rc_lap_timer"
//   npx prisma migrate deploy && npm run build
//   ADMIN_PIN=test1234 SYNC_ALLOWED_ORIGINS=https://kbennett2000.github.io,http://127.0.0.1:3200 \
//     LED_DEVICE_IP=127.0.0.1:3199 npx next start -p 3100 &
//   npm run test:api
//
// The last tests trip the admin PIN lockout, which lives in server memory: restart the server before rerunning.

import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { addRace, call, createCar, createDriver, createLocation, prisma, type Json } from "./helpers";

const ADMIN_PIN = process.env.API_ADMIN_PIN ?? "test1234";
const RUN = Date.now().toString(36);
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let driverId = "";
let carId = "";
let locationId = "";

function sessionBody(id: string, overrides: Record<string, unknown> = {}) {
  return {
    session: {
      id,
      date: "2026-09-30T12:00:00.000Z",
      driverId,
      carId,
      locationId,
      driverName: "client-name",
      carName: "client-name",
      locationName: "client-name",
      laps: [
        { lapNumber: 1, lapTime: 12345.6 },
        { lapNumber: 2, lapTime: 11000 },
      ],
      penalties: [{ lapNumber: 2, count: 1 }],
      totalLaps: 2,
      stats: {},
      ...overrides,
    },
  };
}

describe("drivers, cars and locations", () => {
  it("get UUID ids", async () => {
    driverId = await createDriver(`Test Driver ${RUN}`);
    carId = await createCar(driverId, "Car A", 2);
    locationId = await createLocation(`Backyard ${RUN}`);
    expect(driverId).toMatch(UUID_V4);
    expect(carId).toMatch(UUID_V4);
    expect(locationId).toMatch(UUID_V4);
  });
});

describe("saving a session", () => {
  const sessionId = randomUUID();

  it("creates it the first time", async () => {
    const { json } = await call("POST", "/api/data", sessionBody(sessionId));
    expect(json).toMatchObject({ success: true, created: true });
  });

  it("is a successful no-op when retried", async () => {
    const { json } = await call("POST", "/api/data", sessionBody(sessionId));
    expect(json).toMatchObject({ success: true, created: false });
    expect(await prisma.session.count({ where: { id: sessionId } })).toBe(1);
  });

  it("stores server-side names, rounded laps and the summed total", async () => {
    const { json } = await call("GET", "/api/data");
    const saved = json.sessions.find((s: Json) => s.id === sessionId);
    expect(saved).toMatchObject({
      driverName: `Test Driver ${RUN}`,
      carName: "Car A",
      locationName: `Backyard ${RUN}`,
      totalTime: 23346,
      totalLaps: 2,
    });
    const laps = [...saved.laps].sort((a: Json, b: Json) => a.lapNumber - b.lapNumber).map((l: Json) => l.lapTime);
    expect(laps).toEqual([12346, 11000]);
    expect(saved.penalties.map((p: Json) => p.count)).toEqual([1]);
  });

  it("stays deleted: the old bulk upload is rejected and nothing is re-created", async () => {
    expect((await call("DELETE", "/api/data", { id: sessionId })).json.success).toBe(true);
    const bulk = await call("POST", "/api/data", { sessions: [sessionBody(sessionId).session] });
    expect(bulk.status).toBe(400);
    expect(await prisma.session.count({ where: { id: sessionId } })).toBe(0);
  });

  it("no longer has a clear-all branch", async () => {
    expect((await call("DELETE", "/api/data", { clearAll: true })).status).toBe(400);
  });
});

describe("session validation", () => {
  // Bodies are built when each test runs, after the driver, car and location exist.
  it.each([
    ["no driver", () => ({ session: { id: "abc", date: "2026-01-01" } })],
    ["a negative lap time", () => sessionBody(randomUUID(), { laps: [{ lapNumber: 1, lapTime: -5 }] })],
    ["a null lap time", () => sessionBody(randomUUID(), { laps: [{ lapNumber: 1, lapTime: null }] })],
    ["an unknown driver", () => sessionBody(randomUUID(), { driverId: "nope" })],
    ["an unknown body", () => ({ hello: 1 })],
  ])("rejects %s", async (_label, body) => {
    expect((await call("POST", "/api/data", body())).status).toBe(400);
  });

  it("rejects a car that belongs to another driver", async () => {
    const otherDriver = await createDriver(`Other Driver ${RUN}`);
    const { status } = await call("POST", "/api/data", sessionBody(randomUUID(), { driverId: otherDriver }));
    expect(status).toBe(400);
  });
});

describe("renaming a car", () => {
  let secondCarId = "";

  it("updates the name on saved sessions", async () => {
    const sessionId = randomUUID();
    await call("POST", "/api/data", sessionBody(sessionId));
    const { json } = await call("PATCH", "/api/manage", {
      type: "car",
      id: carId,
      newName: "Car Renamed",
      defaultCarNumber: 2,
    });
    expect(json).toMatchObject({ success: true, car: { name: "Car Renamed", defaultCarNumber: 2 } });
    const saved = await prisma.session.findUnique({ where: { id: sessionId } });
    expect(saved?.carName).toBe("Car Renamed");
  });

  it("refuses a name the driver already uses", async () => {
    secondCarId = await createCar(driverId, "Car B");
    const { status, json } = await call("PATCH", "/api/manage", {
      type: "car",
      id: secondCarId,
      newName: "Car Renamed",
    });
    expect(status).toBe(409);
    expect(json.error).toBe('This driver already has a car named "Car Renamed"');
  });

  it("refuses an empty name", async () => {
    expect((await call("PATCH", "/api/manage", { type: "car", id: secondCarId, newName: "  " })).status).toBe(400);
  });

  it("can delete a car that has race results", async () => {
    const { entryId } = await addRace(locationId, driverId, secondCarId, 1);
    const { json } = await call("DELETE", "/api/manage", { type: "car", driverId, carId: secondCarId });
    expect(json.success).toBe(true);
    expect(await prisma.raceEntry.count({ where: { id: entryId } })).toBe(0);
    expect(await prisma.raceLap.count({ where: { raceEntryId: entryId } })).toBe(0);
  });
});

describe("deletes when race results exist", () => {
  it("deletes a driver with their cars, sessions and race entries", async () => {
    await addRace(locationId, driverId, carId, 2);
    const { json } = await call("DELETE", "/api/manage", { type: "driver", driverId });
    expect(json.success).toBe(true);
    expect(await prisma.driver.count({ where: { id: driverId } })).toBe(0);
    expect(await prisma.car.count({ where: { driverId } })).toBe(0);
    expect(await prisma.session.count({ where: { driverId } })).toBe(0);
    expect(await prisma.raceEntry.count({ where: { driverId } })).toBe(0);
  });

  it("deletes a location with its races, keeping the drivers", async () => {
    const thirdDriver = await createDriver(`Third Driver ${RUN}`);
    const thirdCar = await createCar(thirdDriver, "Car C");
    const { entryId } = await addRace(locationId, thirdDriver, thirdCar, 3);
    const { json } = await call("DELETE", "/api/manage", { type: "location", id: locationId });
    expect(json.success).toBe(true);
    expect(await prisma.race.count({ where: { locationId } })).toBe(0);
    expect(await prisma.raceEntry.count({ where: { id: entryId } })).toBe(0);
    expect(await prisma.driver.count({ where: { id: thirdDriver } })).toBe(1);
  });
});

describe("data rules", () => {
  const motionSettings = { sensitivity: 50, threshold: 1.5, cooldown: 1000, framesToSkip: 10 };
  let ruleDriver = "";
  let ruleCar = "";
  let ruleLocation = "";

  it("trims new names and refuses empty or over-long ones", async () => {
    const { json } = await call("POST", "/api/data", { type: "driver", name: `  Rules Driver ${RUN}  ` });
    expect(json).toMatchObject({ success: true, created: true, driver: { name: `Rules Driver ${RUN}` } });
    ruleDriver = json.driver.id;
    expect((await call("POST", "/api/data", { type: "location", name: "   " })).status).toBe(400);
    expect((await call("POST", "/api/data", { type: "driver", name: "x".repeat(192) })).status).toBe(400);
  });

  it("refuses a duplicate name with a 409, ignoring case", async () => {
    const { status, json } = await call("POST", "/api/data", { type: "driver", name: `rules driver ${RUN}` });
    expect(status).toBe(409);
    expect(json.error).toBe(`A driver named "rules driver ${RUN}" already exists`);
  });

  it("refuses a car for a driver that doesn't exist", async () => {
    expect((await call("POST", "/api/data", { type: "car", name: "Car X", driverId: "nope" })).status).toBe(400);
  });

  it("uses a client's id, and a repeated create returns the same record", async () => {
    const id = randomUUID();
    const body = { type: "location", name: `Rules Track ${RUN}`, id };
    expect((await call("POST", "/api/data", body)).json).toMatchObject({ created: true, location: { id } });
    expect((await call("POST", "/api/data", body)).json).toMatchObject({ created: false, location: { id } });
    expect(await prisma.location.count({ where: { id } })).toBe(1);
    ruleLocation = id;
    expect((await call("POST", "/api/data", { type: "driver", name: `Id ${RUN}`, id: "123" })).status).toBe(400);
  });

  it("returns laps in lap order", async () => {
    ruleCar = await createCar(ruleDriver, "Rules Car", 4);
    const sessionId = randomUUID();
    await call("POST", "/api/data", {
      session: {
        id: sessionId,
        date: "2026-09-30T12:00:00.000Z",
        driverId: ruleDriver,
        carId: ruleCar,
        locationId: ruleLocation,
        laps: [3, 1, 2, 5, 4].map((lapNumber) => ({ lapNumber, lapTime: 10000 + lapNumber })),
      },
    });
    const saved = (await call("GET", "/api/data")).json.sessions.find((s: Json) => s.id === sessionId);
    expect(saved.laps.map((l: Json) => l.lapNumber)).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps a car's number unless the rename changes or clears it", async () => {
    const rename = (body: Record<string, unknown>) =>
      call("PATCH", "/api/manage", { type: "car", id: ruleCar, newName: "Rules Car", ...body });
    expect((await rename({})).json.car.defaultCarNumber).toBe(4);
    expect((await rename({ defaultCarNumber: 6 })).json.car.defaultCarNumber).toBe(6);
    expect((await rename({ defaultCarNumber: null })).json.car.defaultCarNumber).toBeNull();
  });

  it("refuses a rename to a name in use with a 409", async () => {
    const other = await createDriver(`Rules Other ${RUN}`);
    const { status } = await call("PATCH", "/api/manage", {
      type: "driver",
      id: other,
      newName: `Rules Driver ${RUN}`,
    });
    expect(status).toBe(409);
    await call("DELETE", "/api/manage", { type: "driver", driverId: other });
  });

  it("answers 404 for records that don't exist", async () => {
    const missing = randomUUID();
    for (const type of ["driver", "car", "location", "motionSetting"]) {
      expect((await call("PATCH", "/api/manage", { type, id: missing, newName: "Anything" })).status).toBe(404);
    }
    expect((await call("DELETE", "/api/manage", { type: "driver", driverId: missing })).status).toBe(404);
    expect((await call("DELETE", "/api/manage", { type: "car", carId: missing })).status).toBe(404);
    expect((await call("DELETE", "/api/manage", { type: "location", id: missing })).status).toBe(404);
    expect((await call("DELETE", "/api/manage", { type: "motionSetting", id: missing })).status).toBe(404);
    expect((await call("PATCH", "/api/data", { sessionId: missing, notes: "x" })).status).toBe(404);
    expect((await call("PUT", "/api/motion-settings", { id: missing, name: "M", ...motionSettings })).status).toBe(404);
  });

  it("refuses an unknown type", async () => {
    expect((await call("PATCH", "/api/manage", { type: "boat", id: ruleCar, newName: "B" })).status).toBe(400);
    expect((await call("DELETE", "/api/manage", { type: "boat", id: ruleCar })).status).toBe(400);
  });

  it("sets and clears notes", async () => {
    const sessionId = randomUUID();
    await call(
      "POST",
      "/api/data",
      sessionBody(sessionId, { driverId: ruleDriver, carId: ruleCar, locationId: ruleLocation }),
    );
    expect((await call("PATCH", "/api/data", { sessionId, notes: "Loose rear wheel" })).json.session.notes).toBe(
      "Loose rear wheel",
    );
    expect((await call("PATCH", "/api/data", { sessionId, notes: "" })).json.session.notes).toBeNull();
  });

  it("applies the same rules to motion settings", async () => {
    const id = randomUUID();
    const body = { id, name: `  Rules Motion ${RUN} `, ...motionSettings };
    expect((await call("POST", "/api/motion-settings", body)).json).toMatchObject({ id, name: `Rules Motion ${RUN}` });
    expect((await call("POST", "/api/motion-settings", body)).json.id).toBe(id);
    const duplicate = await call("POST", "/api/motion-settings", { ...body, id: randomUUID() });
    expect(duplicate.status).toBe(409);
    expect((await call("POST", "/api/motion-settings", { ...body, id: undefined, sensitivity: 1 })).status).toBe(400);
    expect((await call("DELETE", `/api/motion-settings?id=${id}`)).json.success).toBe(true);
    expect((await call("DELETE", `/api/motion-settings?id=${id}`)).status).toBe(404);
  });

  it("cleans up", async () => {
    expect((await call("DELETE", "/api/manage", { type: "driver", driverId: ruleDriver })).json.success).toBe(true);
    expect((await call("DELETE", "/api/manage", { type: "location", id: ruleLocation })).json.success).toBe(true);
  });
});

describe("session requests", () => {
  let requestId = "";

  it("rejects an invalid request", async () => {
    expect((await call("POST", "/api/session-requests", { driverId: "x" })).status).toBe(400);
  });

  it("creates a request and returns only the request", async () => {
    const requestDriver = await createDriver(`Request Driver ${RUN}`);
    const requestCar = await createCar(requestDriver, "Car R");
    const requestLocation = await createLocation(`Track Four ${RUN}`);
    const { json } = await call("POST", "/api/session-requests", {
      driverId: requestDriver,
      carId: requestCar,
      locationId: requestLocation,
      numberOfLaps: 5,
    });
    expect(json.request.status).toBe("PENDING");
    expect(json).not.toHaveProperty("debug");
    requestId = json.request.id;
  });

  it("returns it from /next", async () => {
    expect((await call("GET", "/api/session-requests/next")).json.request.id).toBe(requestId);
  });

  it("validates status updates", async () => {
    const path = `/api/session-requests/${requestId}/status`;
    expect((await call("PATCH", path, { status: "BOGUS" })).status).toBe(400);
    const { json } = await call("PATCH", path, { status: "IN_PROGRESS" });
    expect(json.request.status).toBe("IN_PROGRESS");
    expect(json).not.toHaveProperty("allRequests");
    const missing = await call("PATCH", "/api/session-requests/does-not-exist/status", { status: "COMPLETED" });
    expect(missing.status).toBe(404);
  });

  it("returns nothing from /next once nothing is pending", async () => {
    expect((await call("GET", "/api/session-requests/next")).json.request).toBeNull();
  });
});

describe("removed debug endpoints", () => {
  it.each([
    ["GET", "/api/session-requests/type-check"],
    ["POST", "/api/session-requests/reset"],
    ["POST", "/api/log"],
  ])("%s %s is gone", async (method, path) => {
    expect((await call(method, path, method === "POST" ? {} : undefined)).status).toBe(404);
  });
});

// Keep these last: they end in the PIN lockout.
describe("/api/system", () => {
  const injectedFile = `/tmp/rclt-pwned-${RUN}`;

  it("rejects a wrong PIN", async () => {
    expect((await call("POST", "/api/system", { adminPin: "nope", deviceName: "abc" })).status).toBe(401);
  });

  it("needs something to change", async () => {
    expect((await call("POST", "/api/system", { adminPin: ADMIN_PIN })).status).toBe(400);
  });

  it.each([
    ["shell syntax in the device name", { deviceName: `$(touch ${injectedFile})` }],
    ["a quote breakout in the password", { userPassword: 'a"; reboot; "bbbbbbb\n' }],
    ["a short password", { userPassword: "short" }],
  ])("rejects %s", async (_label, settings) => {
    expect((await call("POST", "/api/system", { adminPin: ADMIN_PIN, ...settings })).status).toBe(400);
  });

  it("passes a valid request on to the helper (not installed here)", async () => {
    const { status, json } = await call("POST", "/api/system", { adminPin: ADMIN_PIN, deviceName: "rc-lap-timer-2" });
    expect(status).toBe(500);
    expect(json.error).toMatch(/helper/);
    expect(existsSync(injectedFile)).toBe(false);
  });

  it("locks out after five wrong PINs, even for the right PIN", async () => {
    for (let attempt = 1; attempt <= 5; attempt++) {
      expect((await call("POST", "/api/system", { adminPin: "bad" })).status).toBe(401);
    }
    expect((await call("POST", "/api/system", { adminPin: ADMIN_PIN, deviceName: "abc" })).status).toBe(429);
  });
});
