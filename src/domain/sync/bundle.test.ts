import { describe, expect, it } from "vitest";
import { BUNDLE_FORMAT, parseBundle, type Bundle } from "./bundle";

const T1 = "2026-09-01T10:00:00.000Z";
const stamps = { createdAt: T1, updatedAt: T1 };

const valid = (): Bundle => ({
  format: BUNDLE_FORMAT,
  schemaVersion: 1,
  exportedAt: "2026-09-30T12:00:00.000Z",
  deviceId: "phone-1",
  data: {
    drivers: [{ id: "d1", name: "Amy", ...stamps }],
    cars: [{ id: "c1", name: "Slash", driverId: "d1", defaultCarNumber: 3, ...stamps }],
    locations: [{ id: "l1", name: "Backyard", ...stamps }],
    sessions: [
      {
        id: "s1",
        date: T1,
        driverId: "d1",
        driverName: "Amy",
        carId: "c1",
        carName: "Slash",
        locationId: "l1",
        locationName: "Backyard",
        laps: [
          { lapNumber: 1, lapTime: 12_000 },
          { lapNumber: 2, lapTime: 11_000 },
        ],
        penalties: [{ lapNumber: 2, count: 1 }],
        totalTime: 23_000,
        totalLaps: 2,
        notes: "Wet",
        ...stamps,
      },
    ],
    motionSettings: [
      { id: "m1", name: "Sunny", sensitivity: 50, threshold: 1.5, cooldown: 1000, framesToSkip: 10, ...stamps },
    ],
  },
  tombstones: [{ kind: "session", id: "s0", deletedAt: T1 }],
  aliases: [{ kind: "driver", fromId: "d9", toId: "d1" }],
});

describe("parseBundle", () => {
  it("reads a backup file back exactly", () => {
    const bundle = valid();
    expect(parseBundle(JSON.parse(JSON.stringify(bundle)))).toEqual({ ok: true, bundle, dropped: 0 });
  });

  it("refuses files that aren't backups, and backups from a newer version", () => {
    expect(parseBundle({ hello: 1 })).toMatchObject({ ok: false, error: "This isn't an RC Lap Timer backup file." });
    expect(parseBundle([])).toMatchObject({ ok: false });
    expect(parseBundle({ ...valid(), schemaVersion: 2 })).toMatchObject({
      ok: false,
      error: expect.stringContaining("newer version"),
    });
  });

  it("leaves out records that break the rules, and counts them", () => {
    const bundle = valid() as unknown as { data: Record<string, unknown[]>; tombstones: unknown[] };
    bundle.data.drivers.push({ id: "d2", name: "   ", ...stamps });
    bundle.data.cars.push({ id: "c2", name: "No driver", ...stamps });
    bundle.data.sessions.push({ id: "s2", driverId: "d1", carId: "c1", locationId: "l1", date: "soon", laps: [] });
    bundle.data.motionSettings.push({ id: "m2", name: "Too keen", sensitivity: 1, threshold: 1, cooldown: 1000 });
    bundle.tombstones.push({ kind: "boat", id: "b1", deletedAt: T1 }, "junk");
    const parsed = parseBundle(bundle);
    expect(parsed).toMatchObject({ ok: true, dropped: 6 });
    if (parsed.ok) expect(parsed.bundle.data.drivers.map((d) => d.id)).toEqual(["d1"]);
  });

  it("ignores fields it doesn't know, and recomputes the session totals", () => {
    const bundle = valid();
    const session = { ...bundle.data.sessions[0], totalTime: 5, totalLaps: 9, roi: { x: 0.1 } };
    const parsed = parseBundle({ ...bundle, data: { ...bundle.data, sessions: [session] }, extra: true });
    expect(parsed.ok && parsed.bundle.data.sessions[0]).toEqual(valid().data.sessions[0]);
  });
});
