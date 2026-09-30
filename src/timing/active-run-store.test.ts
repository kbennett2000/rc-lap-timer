import { describe, expect, it } from "vitest";
import { ACTIVE_RUN_KEY, loadActiveRun, saveActiveRun } from "./active-run-store";
import { IDLE, reduce, type Run } from "./engine";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

const running = reduce(IDLE, {
  type: "start",
  at: 1000,
  id: "run-1",
  config: {
    driverId: "d",
    driverName: "D",
    carId: "c",
    carName: "C",
    locationId: "l",
    locationName: "L",
    lapTarget: 5,
    timingMode: "motion",
  },
});

describe("active run store", () => {
  it("round-trips a running run", () => {
    const storage = memoryStorage();
    const withLap = reduce(running, { type: "lap", at: 2000 });
    saveActiveRun(withLap, storage);
    expect(loadActiveRun(storage)).toEqual(withLap);
  });

  it("clears the checkpoint once the run is no longer running", () => {
    const storage = memoryStorage();
    saveActiveRun(running, storage);
    saveActiveRun(reduce(running, { type: "end", at: 3000 }) as Run, storage);
    expect(storage.data.has(ACTIVE_RUN_KEY)).toBe(false);
    expect(loadActiveRun(storage)).toBeNull();
  });

  it.each([["not json"], [JSON.stringify({ status: "running", id: 1 })], [JSON.stringify({ status: "finished" })]])(
    "ignores and removes an unreadable checkpoint (%s)",
    (raw) => {
      const storage = memoryStorage();
      storage.setItem(ACTIVE_RUN_KEY, raw);
      expect(loadActiveRun(storage)).toBeNull();
      expect(storage.data.has(ACTIVE_RUN_KEY)).toBe(false);
    },
  );

  it("does nothing without storage", () => {
    expect(() => saveActiveRun(running, null)).not.toThrow();
    expect(loadActiveRun(null)).toBeNull();
  });
});
