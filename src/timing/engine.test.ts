import { describe, expect, it } from "vitest";
import { parseSessionInput } from "@/lib/session-input";
import {
  currentLapElapsed,
  currentLapNumber,
  elapsed,
  gapTotal,
  IDLE,
  lapTimes,
  reduce,
  toSessionPayload,
  type FinishedRun,
  type LapTarget,
  type Run,
  type RunConfig,
  type TimingEvent,
  type TimingMode,
} from "./engine";

const T0 = 1_790_000_000_000;

function config(lapTarget: LapTarget = "unlimited", timingMode: TimingMode = "manual"): RunConfig {
  return {
    driverId: "d1",
    driverName: "Driver",
    carId: "c1",
    carName: "Car",
    locationId: "l1",
    locationName: "Track",
    lapTarget,
    timingMode,
  };
}

function play(events: TimingEvent[], run: Run = IDLE): Run {
  return events.reduce(reduce, run);
}

const start = (lapTarget: LapTarget = "unlimited", timingMode: TimingMode = "manual"): TimingEvent => ({
  type: "start",
  at: T0,
  id: "run-1",
  config: config(lapTarget, timingMode),
});
const lap = (at: number): TimingEvent => ({ type: "lap", at: T0 + at });

describe("reduce", () => {
  it("starts a run", () => {
    const run = play([start()]);
    expect(run).toMatchObject({ status: "running", id: "run-1", startedAt: T0, crossings: [] });
    expect(currentLapNumber(run)).toBe(1);
  });

  it("ignores a second start while running, and run events while idle", () => {
    const running = play([start()]);
    expect(reduce(running, { ...start(), id: "run-2" } as TimingEvent)).toBe(running);
    for (const event of [lap(1), { type: "penalty", at: T0 } as TimingEvent, { type: "end", at: T0 } as TimingEvent]) {
      expect(reduce(IDLE, event)).toBe(IDLE);
    }
  });

  it("computes lap times from the crossing timestamps", () => {
    const run = play([start(), lap(12_345.6), lap(23_345.6), lap(35_000)]);
    expect(lapTimes(run).map((time) => Math.round(time * 10) / 10)).toEqual([12_345.6, 11_000, 11_654.4]);
    expect(currentLapNumber(run)).toBe(4);
    expect(currentLapElapsed(run, T0 + 36_000)).toBe(1000);
    expect(elapsed(run, T0 + 36_000)).toBe(36_000);
  });

  it("never records a crossing before the previous one", () => {
    const run = play([start(), lap(5000), lap(4000)]);
    expect(lapTimes(run)).toEqual([5000, 0]);
  });

  it("finishes by itself when the lap target is reached", () => {
    const run = play([start(3), lap(1000), lap(2000), lap(3000), lap(4000)]);
    expect(run).toMatchObject({ status: "finished", endReason: "target", endedAt: T0 + 3000 });
    expect(lapTimes(run)).toHaveLength(3);
  });

  it("manual finish records the final crossing", () => {
    const run = play([start(), lap(1000), { type: "finish", at: T0 + 2500 }]);
    expect(run).toMatchObject({ status: "finished", endReason: "finish" });
    expect(lapTimes(run)).toEqual([1000, 1500]);
  });

  it("sensor end drops the lap in progress", () => {
    const run = play([start("unlimited", "motion"), lap(1000), lap(2000), { type: "end", at: T0 + 2900 }]);
    expect(run).toMatchObject({ status: "finished", endReason: "end", endedAt: T0 + 2900 });
    expect(lapTimes(run)).toEqual([1000, 1000]);
    expect(elapsed(run, T0 + 99_999)).toBe(2900);
  });

  it("puts penalties on the lap in progress", () => {
    const penalty = (at: number): TimingEvent => ({ type: "penalty", at: T0 + at });
    const run = play([start(), penalty(100), penalty(200), lap(1000), penalty(1500)]);
    expect(run.status === "running" && run.penalties).toEqual([
      { lapNumber: 1, count: 2 },
      { lapNumber: 2, count: 1 },
    ]);
  });

  it("records gaps while the page is hidden", () => {
    const run = play([
      start(),
      { type: "hidden", at: T0 + 1000 },
      { type: "hidden", at: T0 + 1500 },
      { type: "visible", at: T0 + 4000 },
      { type: "visible", at: T0 + 5000 },
    ]);
    expect(run.status === "running" && run.gaps).toEqual([{ from: T0 + 1000, to: T0 + 4000 }]);
    expect(gapTotal(run, T0 + 9000)).toBe(3000);
  });

  it("closes an open gap on resume, or counts from the last event", () => {
    const hidden = play([start(), lap(1000), { type: "hidden", at: T0 + 2000 }, { type: "resume", at: T0 + 9000 }]);
    expect(hidden.status === "running" && hidden.gaps).toEqual([{ from: T0 + 2000, to: T0 + 9000 }]);
    const killed = play([start(), lap(1000), { type: "resume", at: T0 + 9000 }]);
    expect(killed.status === "running" && killed.gaps).toEqual([{ from: T0 + 1000, to: T0 + 9000 }]);
  });

  it("closes open gaps when the run ends", () => {
    const run = play([start(), { type: "hidden", at: T0 + 1000 }, { type: "end", at: T0 + 3000 }]);
    expect(run.status === "finished" && run.gaps).toEqual([{ from: T0 + 1000, to: T0 + 3000 }]);
  });

  it("resets to idle", () => {
    expect(reduce(play([start(), { type: "end", at: T0 + 1 }]), { type: "reset" })).toBe(IDLE);
  });
});

describe("toSessionPayload", () => {
  it("builds a session /api/data accepts", () => {
    const run = play([
      start(),
      { type: "penalty", at: T0 + 10 },
      lap(12_345.6),
      { type: "finish", at: T0 + 23_345.6 },
    ]) as FinishedRun;
    const payload = toSessionPayload(run);
    expect(payload).toMatchObject({
      id: "run-1",
      date: new Date(T0).toISOString(),
      laps: [
        { lapNumber: 1, lapTime: 12_346 },
        { lapNumber: 2, lapTime: 11_000 },
      ],
      penalties: [{ lapNumber: 1, count: 1 }],
      totalLaps: 2,
      stats: { totalTime: 23_346, totalPenalties: 1 },
    });
    expect(parseSessionInput(payload).ok).toBe(true);
  });

  it("leaves out penalties on a dropped lap and reports the lap target", () => {
    const run = play([start(10, "ir"), lap(1000), { type: "penalty", at: T0 + 1500 }, { type: "end", at: T0 + 1800 }]);
    const payload = toSessionPayload(run as FinishedRun);
    expect(payload.laps).toHaveLength(1);
    expect(payload.penalties).toEqual([]);
    expect(payload.totalLaps).toBe(10);
  });
});
