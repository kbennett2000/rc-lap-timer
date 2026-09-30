import { describe, expect, it, vi } from "vitest";
import { createTimingStore } from "./timing-store";
import type { RunConfig } from "./engine";

const config = {
  driverId: "d",
  driverName: "D",
  carId: "c",
  carName: "C",
  locationId: "l",
  locationName: "L",
  lapTarget: "unlimited",
  timingMode: "manual",
} satisfies RunConfig;

describe("createTimingStore", () => {
  it("runs effects and notifies subscribers only when the run changes", () => {
    const store = createTimingStore();
    const effect = vi.fn();
    const listener = vi.fn();
    store.addEffect(effect);
    store.subscribe(listener);

    store.dispatch({ type: "lap", at: 1 }); // idle: ignored
    expect(effect).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();

    const running = store.dispatch({ type: "start", at: 0, id: "r", config });
    expect(effect).toHaveBeenCalledWith(running, { status: "idle" }, expect.objectContaining({ type: "start" }));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getState()).toBe(running);
  });

  it("restores a run without running effects", () => {
    const store = createTimingStore();
    const effect = vi.fn();
    store.addEffect(effect);
    const other = createTimingStore();
    const run = other.dispatch({ type: "start", at: 0, id: "r", config });
    store.restore(run);
    expect(store.getState()).toBe(run);
    expect(effect).not.toHaveBeenCalled();
  });

  it("stops calling removed effects and listeners", () => {
    const store = createTimingStore();
    const effect = vi.fn();
    const removeEffect = store.addEffect(effect);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    removeEffect();
    unsubscribe();
    store.dispatch({ type: "start", at: 0, id: "r", config });
    expect(effect).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });
});
