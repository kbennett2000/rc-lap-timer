import { randomUUID } from "node:crypto";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { LapTimerDB } from "@/data/local/db";
import { createLocalDataStore } from "@/data/local/local-data-store";
import { parseBundle } from "@/domain/sync/bundle";
import { hasChanges } from "@/domain/sync/merge";
import { SyncError, syncWithTimer, timerUrls } from "./sync";

const newStore = () => createLocalDataStore(new LapTimerDB({ indexedDB: new IDBFactory(), IDBKeyRange }));
type Store = ReturnType<typeof newStore>;

// A timer at http://timer, answering the sync routes the way the Pi does, with another store behind them.
function fakeTimer(timer: Store, status: object = { app: "rc-lap-timer", schemaVersion: 1, deviceId: "pi" }) {
  const urls: string[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    urls.push(`${init?.method ?? "GET"} ${url}`);
    if (!url.startsWith("http://timer/")) throw new TypeError("Failed to fetch");
    const path = url.slice("http://timer".length);
    if (path === "/api/sync/status") return Response.json(status);
    if (path === "/api/sync" && init?.method === "POST") {
      const parsed = parseBundle(JSON.parse(String(init.body)).bundle);
      if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
      return Response.json({ summary: await timer.importBundle(parsed.bundle), dropped: parsed.dropped });
    }
    if (path === "/api/sync") return Response.json(await timer.exportBundle());
    return Response.json({ error: "Not found" }, { status: 404 });
  };
  return { fetch: fetch as typeof globalThis.fetch, urls };
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

describe("syncing with the timer", () => {
  it("leaves both sides with the same data, using the timer's records for names they share", async () => {
    const phone = newStore();
    const timer = newStore();
    const mine = await addSession(phone, "Amy");
    const theirs = await addSession(timer, "amy");
    await timer.createDriver("Bob");
    await phone.createMotionSettings({ name: "Sunny", sensitivity: 50, threshold: 1, cooldown: 500, framesToSkip: 10 });

    const result = await syncWithTimer(phone, { address: "timer", fetch: fakeTimer(timer).fetch });
    expect(result.baseUrl).toBe("http://timer");
    expect(result.timer.driver.merged).toBe(1);
    expect(result.timer.session.added).toBe(1);
    expect(result.phone.driver.added).toBe(1);

    expect(await everything(phone)).toEqual(await everything(timer));
    const { drivers, sessions } = await phone.loadSnapshot();
    expect(drivers.map((d) => d.id).sort()).toEqual(
      [theirs.driver.id, drivers.find((d) => d.name === "Bob")!.id].sort(),
    );
    expect(sessions.find((s) => s.id === mine.session.id)).toMatchObject({
      driverId: theirs.driver.id,
      carId: theirs.car.id,
      driverName: "amy",
    });
  });

  it("changes nothing the second time", async () => {
    const phone = newStore();
    const timer = newStore();
    await addSession(phone, "Amy");
    await addSession(timer, "Bob");
    const { fetch } = fakeTimer(timer);
    await syncWithTimer(phone, { address: "timer", fetch });
    const again = await syncWithTimer(phone, { address: "timer", fetch });
    expect(hasChanges(again.timer)).toBe(false);
    expect(hasChanges(again.phone)).toBe(false);
  });

  it("takes deletes both ways", async () => {
    const phone = newStore();
    const timer = newStore();
    const { session } = await addSession(phone, "Amy");
    const { fetch } = fakeTimer(timer);
    await syncWithTimer(phone, { address: "timer", fetch });
    await timer.deleteSession(session.id);
    const result = await syncWithTimer(phone, { address: "timer", fetch });
    expect(result.phone.session.deleted).toBe(1);
    expect((await phone.loadSnapshot()).sessions).toEqual([]);
  });

  it("tries plain HTTP, then HTTPS, starting with the address that worked last time", async () => {
    expect(timerUrls(" 192.168.4.1/ ")).toEqual(["http://192.168.4.1", "https://192.168.4.1"]);
    expect(timerUrls("192.168.4.1", "https://192.168.4.1")).toEqual(["https://192.168.4.1", "http://192.168.4.1"]);
    expect(timerUrls("https://rc-lap-timer.local/", "http://rc-lap-timer.local")).toEqual([
      "https://rc-lap-timer.local",
    ]);

    const { fetch, urls } = fakeTimer(newStore());
    await syncWithTimer(newStore(), { address: "timer", lastWorked: "https://timer", fetch });
    expect(urls.slice(0, 2)).toEqual(["GET https://timer/api/sync/status", "GET http://timer/api/sync/status"]);
  });

  it("says when the timer can't be reached, or what answered isn't one", async () => {
    const offline = (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;
    await expect(syncWithTimer(newStore(), { address: "timer", fetch: offline })).rejects.toMatchObject({
      problem: "unreachable",
    });
    const router = (async () => new Response("<html>", { status: 404 })) as typeof fetch;
    await expect(syncWithTimer(newStore(), { address: "timer", fetch: router })).rejects.toBeInstanceOf(SyncError);
    await expect(syncWithTimer(newStore(), { address: "timer", fetch: router })).rejects.toMatchObject({
      problem: "not-a-timer",
    });
  });

  it("won't sync with a timer whose backups are a different version", async () => {
    const newer = fakeTimer(newStore(), { app: "rc-lap-timer", schemaVersion: 2 });
    await expect(syncWithTimer(newStore(), { address: "timer", fetch: newer.fetch })).rejects.toMatchObject({
      problem: "update-app",
    });
    const older = fakeTimer(newStore(), { app: "rc-lap-timer", schemaVersion: 0 });
    await expect(syncWithTimer(newStore(), { address: "timer", fetch: older.fetch })).rejects.toMatchObject({
      problem: "update-timer",
    });
    expect(newer.urls.some((url) => url.startsWith("POST"))).toBe(false);
  });
});
