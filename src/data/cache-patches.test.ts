import { describe, expect, it } from "vitest";
import type { Car, Driver, Location, MotionSettings, SessionRecord } from "@/domain/types";
import * as patch from "./cache-patches";

const stamps = { createdAt: "2026-09-30T10:00:00.000Z", updatedAt: "2026-09-30T10:00:00.000Z" };
const car = (id: string, name: string, driverId: string): Car => ({
  id,
  name,
  driverId,
  defaultCarNumber: null,
  ...stamps,
});
const driver = (id: string, name: string, cars: Car[] = []): Driver => ({ id, name, cars, ...stamps });
const location = (id: string, name: string): Location => ({ id, name, ...stamps });
const session = (id: string, driverId: string, carId: string, locationId: string): SessionRecord => ({
  id,
  date: "2026-09-30T09:00:00.000Z",
  driverId,
  driverName: "",
  carId,
  carName: "",
  locationId,
  locationName: "",
  laps: [{ lapNumber: 1, lapTime: 1000 }],
  penalties: [],
  totalTime: 1000,
  totalLaps: 1,
  notes: null,
  ...stamps,
});

// Frozen, so any patch that modifies what it's given throws.
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

const data = () =>
  deepFreeze(
    patch.toAppData({
      drivers: [driver("d1", "Amy", [car("c1", "Slash", "d1"), car("c2", "Stampede", "d1")]), driver("d2", "Zed")],
      locations: [location("l1", "Backyard"), location("l2", "Park")],
      sessions: [session("s1", "d1", "c1", "l1"), session("s2", "d1", "c2", "l2"), session("s3", "d2", "c3", "l1")],
    }),
  );

const ids = (items: { id: string }[]) => items.map((item) => item.id);

describe("cache patches", () => {
  it("adds statistics to sessions", () => {
    expect(data().sessions[0].stats).toMatchObject({ totalTime: 1000, bestLap: 1000 });
  });

  it("keeps drivers, cars and locations in name order", () => {
    expect(ids(patch.addDriver(data(), driver("d3", "Bob")).drivers)).toEqual(["d1", "d3", "d2"]);
    expect(ids(patch.renameDriver(data(), "d2", "Abe").drivers)).toEqual(["d2", "d1"]);
    expect(ids(patch.addCar(data(), car("c4", "Rustler", "d1")).drivers[0].cars)).toEqual(["c4", "c1", "c2"]);
    expect(ids(patch.addLocation(data(), location("l3", "Arena")).locations)).toEqual(["l3", "l1", "l2"]);
  });

  it("doesn't add a record twice", () => {
    expect(ids(patch.addDriver(data(), driver("d1", "Amy")).drivers)).toEqual(["d1", "d2"]);
  });

  it("updates a car wherever it is", () => {
    const updated = patch.updateCar(data(), "c2", { name: "Bandit", defaultCarNumber: 4 });
    expect(updated.drivers[0].cars[0]).toMatchObject({ id: "c2", name: "Bandit", defaultCarNumber: 4 });
  });

  it("removes a record with the sessions it takes with it", () => {
    expect(ids(patch.removeDriver(data(), "d1").sessions)).toEqual(["s3"]);
    const withoutCar = patch.removeCar(data(), "c1");
    expect(ids(withoutCar.drivers[0].cars)).toEqual(["c2"]);
    expect(ids(withoutCar.sessions)).toEqual(["s2", "s3"]);
    expect(ids(patch.removeLocation(data(), "l1").sessions)).toEqual(["s2"]);
    expect(ids(patch.removeSession(data(), "s2").sessions)).toEqual(["s1", "s3"]);
  });

  it("stores an empty note as none", () => {
    expect(patch.setSessionNotes(data(), "s1", "Wet").sessions[0].notes).toBe("Wet");
    expect(patch.setSessionNotes(data(), "s1", "").sessions[0].notes).toBeNull();
  });

  it("patches motion settings", () => {
    const settings = (id: string, name: string): MotionSettings => ({
      id,
      name,
      sensitivity: 50,
      threshold: 1,
      cooldown: 500,
      framesToSkip: 10,
      ...stamps,
    });
    const list = deepFreeze([settings("m1", "Cloudy"), settings("m2", "Sunny")]);
    expect(ids(patch.addMotionSettings(list, settings("m3", "Dusk")))).toEqual(["m1", "m3", "m2"]);
    const input = { name: "Bright", sensitivity: 80, threshold: 1, cooldown: 500, framesToSkip: 10 };
    expect(patch.updateMotionSettings(list, "m2", input)[0]).toMatchObject({ id: "m2", ...input });
    expect(ids(patch.removeMotionSettings(list, "m1"))).toEqual(["m2"]);
  });
});
