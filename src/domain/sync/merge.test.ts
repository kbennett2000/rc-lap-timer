import { describe, expect, it } from "vitest";
import type { Car, Location, MotionSettings, SessionRecord } from "@/domain/types";
import { EMPTY_CONTENTS, type BundleContents, type DriverRecord, type Tombstone } from "./bundle";
import { hasChanges, mergeBundles, planWrites } from "./merge";

const T1 = "2026-09-01T10:00:00.000Z";
const T2 = "2026-09-02T10:00:00.000Z";
const T3 = "2026-09-03T10:00:00.000Z";
const NOW = "2026-09-30T12:00:00.000Z";

const driver = (id: string, name: string, updatedAt = T1): DriverRecord => ({ id, name, createdAt: T1, updatedAt });
const car = (id: string, driverId: string, name: string, updatedAt = T1): Car => ({
  id,
  name,
  driverId,
  defaultCarNumber: null,
  createdAt: T1,
  updatedAt,
});
const location = (id: string, name: string, updatedAt = T1): Location => ({ id, name, createdAt: T1, updatedAt });
const motion = (id: string, name: string, sensitivity = 50, updatedAt = T1): MotionSettings => ({
  id,
  name,
  sensitivity,
  threshold: 1,
  cooldown: 1000,
  framesToSkip: 10,
  createdAt: T1,
  updatedAt,
});
const session = (
  id: string,
  refs: { driverId: string; carId: string; locationId: string },
  notes: string | null = null,
  updatedAt = T1,
): SessionRecord => ({
  id,
  date: T1,
  ...refs,
  driverName: "",
  carName: "",
  locationName: "",
  laps: [{ lapNumber: 1, lapTime: 10_000 }],
  penalties: [],
  totalTime: 10_000,
  totalLaps: 1,
  notes,
  createdAt: T1,
  updatedAt,
});
const dead = (kind: Tombstone["kind"], id: string, deletedAt = T2): Tombstone => ({ kind, id, deletedAt });

function contents(parts: Partial<BundleContents["data"]> & { tombstones?: Tombstone[] } = {}): BundleContents {
  const { tombstones = [], ...data } = parts;
  return { ...EMPTY_CONTENTS, data: { ...EMPTY_CONTENTS.data, ...data }, tombstones, aliases: [] };
}

// Amy with her Slash, at the Backyard, with one session.
const amy = () =>
  contents({
    drivers: [driver("d1", "Amy")],
    cars: [car("c1", "d1", "Slash")],
    locations: [location("l1", "Backyard")],
    sessions: [session("s1", { driverId: "d1", carId: "c1", locationId: "l1" })],
  });

const ids = (records: { id: string }[]) => records.map((r) => r.id).sort();

describe("mergeBundles", () => {
  it("adds what's new, and fills in the names on sessions", () => {
    const { merged, summary } = mergeBundles(EMPTY_CONTENTS, amy(), NOW);
    expect(ids(merged.data.sessions)).toEqual(["s1"]);
    expect(merged.data.sessions[0]).toMatchObject({ driverName: "Amy", carName: "Slash", locationName: "Backyard" });
    expect(summary.driver.added).toBe(1);
    expect(summary.session.added).toBe(1);
  });

  it("keeps the most recently changed version of a record, and the local one on a tie", () => {
    const local = contents({ drivers: [driver("d1", "Amy", T2)], motionSettings: [motion("m1", "Sunny", 50, T2)] });
    const newer = contents({ drivers: [driver("d1", "Amelia", T3)], motionSettings: [motion("m1", "Sunny", 80, T1)] });
    const { merged, summary } = mergeBundles(local, newer, NOW);
    expect(merged.data.drivers[0].name).toBe("Amelia");
    expect(merged.data.motionSettings[0].sensitivity).toBe(50);
    expect(summary.driver.updated).toBe(1);
    expect(summary.motionSettings.updated).toBe(0);

    const tie = mergeBundles(local, contents({ drivers: [driver("d1", "Amelia", T2)] }), NOW);
    expect(tie.merged.data.drivers[0].name).toBe("Amy");
  });

  it("only ever changes a session's notes, and the more recent notes win", () => {
    const local = amy();
    const incoming = amy();
    incoming.data.sessions[0] = { ...incoming.data.sessions[0], notes: "Wet track", updatedAt: T2, totalTime: 1 };
    const { merged, summary } = mergeBundles(local, incoming, NOW);
    expect(merged.data.sessions[0]).toMatchObject({ notes: "Wet track", updatedAt: T2, totalTime: 10_000 });
    expect(summary.session.updated).toBe(1);

    const older = amy();
    older.data.sessions[0] = { ...older.data.sessions[0], notes: "Old note", updatedAt: T1 };
    const kept = mergeBundles(merged, older, NOW);
    expect(kept.merged.data.sessions[0].notes).toBe("Wet track");
  });

  it("lets deletes win, with everything they cascade to", () => {
    const { merged, summary } = mergeBundles(amy(), contents({ tombstones: [dead("driver", "d1")] }), NOW);
    expect(merged.data.drivers).toEqual([]);
    expect(merged.data.cars).toEqual([]);
    expect(merged.data.sessions).toEqual([]);
    expect(merged.tombstones.map((t) => `${t.kind}:${t.id}`).sort()).toEqual(["car:c1", "driver:d1", "session:s1"]);
    expect(summary.driver.deleted).toBe(1);
    expect(summary.session.deleted).toBe(1);
  });

  it("doesn't bring back what was deleted here", () => {
    const local = contents({ ...amy().data, sessions: [], tombstones: [dead("session", "s1")] });
    const { merged, summary } = mergeBundles(local, amy(), NOW);
    expect(merged.data.sessions).toEqual([]);
    expect(summary.session.added).toBe(0);
  });

  it("folds a record with the same name into the local one, and moves what belongs to it", () => {
    const local = contents({ drivers: [driver("d1", "Amy")], cars: [car("c1", "d1", "Slash")] });
    const incoming = contents({
      drivers: [driver("d2", "amy")],
      cars: [car("c2", "d2", "SLASH"), car("c3", "d2", "Rustler")],
      locations: [location("l1", "Backyard")],
      sessions: [session("s2", { driverId: "d2", carId: "c2", locationId: "l1" })],
    });
    const { merged, summary } = mergeBundles(local, incoming, NOW);
    expect(ids(merged.data.drivers)).toEqual(["d1"]);
    expect(ids(merged.data.cars)).toEqual(["c1", "c3"]);
    expect(merged.data.cars.find((c) => c.id === "c3")?.driverId).toBe("d1");
    expect(merged.data.sessions[0]).toMatchObject({ id: "s2", driverId: "d1", carId: "c1", driverName: "Amy" });
    expect(merged.aliases).toEqual([
      { kind: "driver", fromId: "d2", toId: "d1" },
      { kind: "car", fromId: "c2", toId: "c1" },
    ]);
    expect(summary.driver.merged).toBe(1);
    expect(summary.car).toMatchObject({ merged: 1, added: 1 });
  });

  it("puts a later change from the same phone into the record it was folded into", () => {
    const first = mergeBundles(
      contents({ drivers: [driver("d1", "Bob")] }),
      contents({ drivers: [driver("d2", "Bob")] }),
    );
    const renamed = contents({ drivers: [driver("d2", "Robert", T3)] });
    const { merged, summary } = mergeBundles(first.merged, renamed, NOW);
    expect(merged.data.drivers).toEqual([driver("d1", "Robert", T3)]);
    expect(summary.driver.updated).toBe(1);
  });

  it("teaches the other phone the alias, moving its own record and sessions over", () => {
    // Phone A folded B's d2 into its d1; now B restores A's backup.
    const phoneB = contents({
      drivers: [driver("d2", "Bob")],
      cars: [car("c2", "d2", "Slash")],
      locations: [location("l1", "Backyard")],
      sessions: [session("s2", { driverId: "d2", carId: "c2", locationId: "l1" })],
    });
    const fromA: BundleContents = {
      ...contents({
        drivers: [driver("d1", "Bob")],
        cars: [car("c1", "d1", "Slash")],
        locations: [location("l1", "Backyard")],
      }),
      aliases: [
        { kind: "driver", fromId: "d2", toId: "d1" },
        { kind: "car", fromId: "c2", toId: "c1" },
      ],
    };
    const { merged } = mergeBundles(phoneB, fromA, NOW);
    expect(ids(merged.data.drivers)).toEqual(["d1"]);
    expect(merged.data.sessions[0]).toMatchObject({ driverId: "d1", carId: "c1" });
    const writes = planWrites(phoneB, merged);
    expect(writes.drivers.remove).toEqual(["d2"]);
    expect(writes.sessions.put.map((s) => s.driverId)).toEqual(["d1"]);
  });

  it("skips sessions whose driver, car or location is missing", () => {
    const incoming = contents({
      drivers: [driver("d1", "Amy")],
      cars: [car("c1", "d1", "Slash")],
      sessions: [session("s1", { driverId: "d1", carId: "c1", locationId: "nowhere" })],
    });
    const { merged, summary } = mergeBundles(EMPTY_CONTENTS, incoming, NOW);
    expect(merged.data.sessions).toEqual([]);
    expect(summary.session.skipped).toBe(1);
  });

  it("skips a rename to a name another record has", () => {
    const local = contents({ drivers: [driver("d1", "Amy"), driver("d2", "Bob")] });
    const { merged, summary } = mergeBundles(local, contents({ drivers: [driver("d2", "amy", T3)] }), NOW);
    expect(merged.data.drivers.find((d) => d.id === "d2")?.name).toBe("Bob");
    expect(summary.driver.skipped).toBe(1);
  });

  it("changes nothing when the same data is merged again", () => {
    const incoming = contents({
      drivers: [driver("d2", "amy", T3), driver("d9", "Zed")],
      cars: [car("c2", "d2", "Slash")],
      locations: [location("l1", "Backyard")],
      sessions: [session("s2", { driverId: "d2", carId: "c2", locationId: "l1" }, "Note", T2)],
      tombstones: [dead("session", "s1")],
    });
    const once = mergeBundles(amy(), incoming, NOW);
    const twice = mergeBundles(once.merged, incoming, NOW);
    expect(hasChanges(twice.summary)).toBe(false);
    const writes = planWrites(once.merged, twice.merged);
    expect(Object.values(writes).flatMap((w) => (Array.isArray(w) ? w : [...w.put, ...w.remove]))).toEqual([]);
  });

  it("merges into an empty app as a straight copy", () => {
    const { merged } = mergeBundles(EMPTY_CONTENTS, amy(), NOW);
    const again = mergeBundles(merged, EMPTY_CONTENTS, NOW);
    expect(hasChanges(again.summary)).toBe(false);
  });
});

describe("planWrites", () => {
  it("lists only what changed", () => {
    const before = amy();
    const after = amy();
    after.data.drivers = [driver("d1", "Amelia", T2)];
    after.data.locations = [];
    after.tombstones = [dead("location", "l1")];
    const writes = planWrites(before, after);
    expect(writes.drivers.put.map((d) => d.name)).toEqual(["Amelia"]);
    expect(writes.cars).toEqual({ put: [], remove: [] });
    expect(writes.locations.remove).toEqual(["l1"]);
    expect(writes.tombstones).toEqual([dead("location", "l1")]);
  });
});
