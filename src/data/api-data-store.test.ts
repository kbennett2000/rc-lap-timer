import { describe, expect, it } from "vitest";
import { isUuid } from "@/domain/rules";
import { createApiDataStore } from "./api-data-store";
import { DataStoreError } from "./types";

interface Call {
  method: string;
  url: string;
  body: Record<string, unknown> | undefined;
}

// A fetch that records requests and answers each with the next reply (or throws, for a network failure).
function fakeApi(...replies: ({ status?: number; body?: unknown } | "offline")[]) {
  const calls: Call[] = [];
  const fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      method: init?.method ?? "GET",
      url: String(url),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const reply = replies.shift() ?? {};
    if (reply === "offline") throw new TypeError("Failed to fetch");
    return new Response(JSON.stringify(reply.body ?? { success: true }), { status: reply.status ?? 200 });
  };
  return { calls, store: createApiDataStore({ baseUrl: "http://pi", fetch: fetch as typeof globalThis.fetch }) };
}

const stamps = { createdAt: "2026-09-30T10:00:00.000Z", updatedAt: "2026-09-30T10:00:00.000Z" };

describe("loadSnapshot", () => {
  it("copies out the domain fields, with lists in order", async () => {
    const { store, calls } = fakeApi({
      body: {
        drivers: [
          {
            id: "d2",
            name: "Zed",
            cars: [
              { id: "c2", name: "Slash", driverId: "d2", defaultCarNumber: null, ...stamps },
              { id: "c1", name: "Rustler", driverId: "d2", defaultCarNumber: 3, ...stamps, driver: {} },
            ],
            ...stamps,
          },
          { id: "d1", name: "Amy", ...stamps },
        ],
        locations: [{ id: "l1", name: "Backyard", ...stamps, sessions: [] }],
        sessions: [
          {
            id: "s1",
            date: "2026-09-30T09:00:00.000Z",
            driverId: "d2",
            driverName: "Zed",
            carId: "c1",
            carName: "Rustler",
            locationId: "l1",
            locationName: "Backyard",
            laps: [
              { id: "x", sessionId: "s1", lapNumber: 2, lapTime: 900, ...stamps },
              { id: "y", sessionId: "s1", lapNumber: 1, lapTime: 1000, ...stamps },
            ],
            penalties: [{ id: "p", sessionId: "s1", lapNumber: 2, count: 1, ...stamps }],
            totalTime: 1900,
            totalLaps: 2,
            notes: null,
            driver: { id: "d2" },
            ...stamps,
          },
        ],
      },
    });

    const snapshot = await store.loadSnapshot();

    expect(calls).toEqual([{ method: "GET", url: "http://pi/api/data", body: undefined }]);
    expect(snapshot.drivers.map((d) => d.name)).toEqual(["Amy", "Zed"]);
    expect(snapshot.drivers[0].cars).toEqual([]);
    expect(snapshot.drivers[1].cars).toEqual([
      { id: "c1", name: "Rustler", driverId: "d2", defaultCarNumber: 3, ...stamps },
      { id: "c2", name: "Slash", driverId: "d2", defaultCarNumber: null, ...stamps },
    ]);
    expect(snapshot.locations).toEqual([{ id: "l1", name: "Backyard", ...stamps }]);
    expect(snapshot.sessions[0]).toEqual({
      id: "s1",
      date: "2026-09-30T09:00:00.000Z",
      driverId: "d2",
      driverName: "Zed",
      carId: "c1",
      carName: "Rustler",
      locationId: "l1",
      locationName: "Backyard",
      laps: [
        { lapNumber: 1, lapTime: 1000 },
        { lapNumber: 2, lapTime: 900 },
      ],
      penalties: [{ lapNumber: 2, count: 1 }],
      totalTime: 1900,
      totalLaps: 2,
      notes: null,
      ...stamps,
    });
  });
});

describe("changes", () => {
  it("sends a new id with every create", async () => {
    const { store, calls } = fakeApi(
      { body: { driver: { id: "d1", name: "Amy", cars: [], ...stamps } } },
      { body: { car: { id: "c1", name: "Slash", driverId: "d1", defaultCarNumber: null, ...stamps } } },
      { body: { location: { id: "l1", name: "Backyard", ...stamps } } },
      { body: { id: "m1", name: "Sunny", sensitivity: 50, threshold: 1, cooldown: 500, framesToSkip: 10, ...stamps } },
    );

    expect(await store.createDriver("Amy")).toEqual({ id: "d1", name: "Amy", cars: [], ...stamps });
    await store.createCar({ driverId: "d1", name: "Slash", defaultCarNumber: null });
    await store.createLocation("Backyard");
    await store.createMotionSettings({ name: "Sunny", sensitivity: 50, threshold: 1, cooldown: 500, framesToSkip: 10 });

    expect(calls.map((c) => [c.method, c.url, c.body?.type])).toEqual([
      ["POST", "http://pi/api/data", "driver"],
      ["POST", "http://pi/api/data", "car"],
      ["POST", "http://pi/api/data", "location"],
      ["POST", "http://pi/api/motion-settings", undefined],
    ]);
    for (const call of calls) expect(isUuid(call.body?.id)).toBe(true);
    expect(calls[1].body).toMatchObject({ driverId: "d1", name: "Slash", defaultCarNumber: null });
  });

  it("always sends the car number, so null clears it", async () => {
    const { store, calls } = fakeApi();
    await store.updateCar("c1", { name: "Slash", defaultCarNumber: null });
    expect(calls[0]).toMatchObject({
      method: "PATCH",
      url: "http://pi/api/manage",
      body: { type: "car", id: "c1", newName: "Slash", defaultCarNumber: null },
    });
  });

  it("names each record the way its route expects", async () => {
    const { store, calls } = fakeApi();
    await store.renameDriver("d1", "Amy");
    await store.renameLocation("l1", "Park");
    await store.deleteDriver("d1");
    await store.deleteCar("c1");
    await store.deleteLocation("l1");
    await store.updateSessionNotes("s1", "Wet track");
    await store.deleteSession("s1");
    await store.deleteMotionSettings("m 1");

    expect(calls.map(({ method, url, body }) => [method, url, body])).toEqual([
      ["PATCH", "http://pi/api/manage", { type: "driver", id: "d1", newName: "Amy" }],
      ["PATCH", "http://pi/api/manage", { type: "location", id: "l1", newName: "Park" }],
      ["DELETE", "http://pi/api/manage", { type: "driver", driverId: "d1" }],
      ["DELETE", "http://pi/api/manage", { type: "car", carId: "c1" }],
      ["DELETE", "http://pi/api/manage", { type: "location", id: "l1" }],
      ["PATCH", "http://pi/api/data", { sessionId: "s1", notes: "Wet track" }],
      ["DELETE", "http://pi/api/data", { id: "s1" }],
      ["DELETE", "http://pi/api/motion-settings?id=m%201", undefined],
    ]);
  });

  it("reports whether a session was new", async () => {
    const { store } = fakeApi({ body: { success: true, created: true } }, { body: { success: true, created: false } });
    const session = {
      id: "s1",
      date: "2026-09-30T09:00:00.000Z",
      driverId: "d1",
      driverName: "Amy",
      carId: "c1",
      carName: "Slash",
      locationId: "l1",
      locationName: "Backyard",
      laps: [{ lapNumber: 1, lapTime: 1000 }],
      penalties: [],
    };
    expect(await store.saveSession(session)).toEqual({ created: true });
    expect(await store.saveSession(session)).toEqual({ created: false });
  });
});

describe("errors", () => {
  it.each([
    [409, "duplicate"],
    [400, "invalid"],
    [404, "not-found"],
    [500, "unavailable"],
  ])("maps %i to %s, with the server's message", async (status, kind) => {
    const { store } = fakeApi({ status, body: { error: "Nope" } });
    const error = await store.renameDriver("d1", "Amy").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DataStoreError);
    expect(error).toMatchObject({ kind, message: "Nope" });
  });

  it("includes validation details", async () => {
    const { store } = fakeApi({
      status: 400,
      body: { error: "Invalid input data", details: ["Too big", "Too small"] },
    });
    await expect(
      store.updateMotionSettings("m1", { name: "M", sensitivity: 1, threshold: 1, cooldown: 1, framesToSkip: 1 }),
    ).rejects.toMatchObject({ kind: "invalid", message: "Invalid input data: Too big; Too small" });
  });

  it("says when the Pi can't be reached", async () => {
    const { store } = fakeApi("offline");
    await expect(store.loadSnapshot()).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("counts a delete of something already gone as done", async () => {
    const { store } = fakeApi({ status: 404, body: { error: "Session not found" } });
    await expect(store.deleteSession("s1")).resolves.toBeUndefined();
  });

  it("still reports a missing record when changing it", async () => {
    const { store } = fakeApi({ status: 404, body: { error: "Session not found" } });
    await expect(store.updateSessionNotes("s1", "x")).rejects.toMatchObject({ kind: "not-found" });
  });
});
