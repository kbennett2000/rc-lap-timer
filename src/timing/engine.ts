// The practice timing engine: a pure reducer over timestamped events. Every timing mode (manual taps, motion
// detection, IR beacons) feeds it the same events, so they share one set of rules.

import { lapStats } from "@/domain/stats";
import type { LapStats, PenaltyData } from "@/domain/types";

export type TimingMode = "manual" | "motion" | "ir";
export type LapTarget = number | "unlimited";
export type EndReason = "target" | "finish" | "end";

export interface RunConfig {
  driverId: string;
  driverName: string;
  carId: string;
  carName: string;
  locationId: string;
  locationName: string;
  lapTarget: LapTarget;
  timingMode: TimingMode;
}

// A stretch of time the page was hidden or gone while running; laps may have been missed. `to` is null while open.
export interface Gap {
  from: number;
  to: number | null;
}

interface RunData {
  id: string;
  config: RunConfig;
  startedAt: number;
  crossings: number[]; // when each lap ended
  penalties: PenaltyData[];
  gaps: Gap[];
  lastEventAt: number;
}

export type IdleRun = { status: "idle" };
export type RunningRun = RunData & { status: "running" };
export type FinishedRun = RunData & { status: "finished"; endedAt: number; endReason: EndReason };
export type Run = IdleRun | RunningRun | FinishedRun;

export type TimingEvent =
  | { type: "start"; at: number; id: string; config: RunConfig }
  | { type: "lap"; at: number } // the car crossed the line
  | { type: "penalty"; at: number } // on the lap in progress
  | { type: "finish"; at: number } // manual Stop: the final crossing, then end
  | { type: "end"; at: number } // sensor Stop: end now, dropping the lap in progress
  | { type: "hidden"; at: number }
  | { type: "visible"; at: number }
  | { type: "resume"; at: number } // carrying on after the page was reloaded
  | { type: "reset" };

export const IDLE: IdleRun = { status: "idle" };

function closeGaps(gaps: Gap[], at: number): Gap[] {
  return gaps.map((gap) => (gap.to === null ? { ...gap, to: at } : gap));
}

function finished(run: RunningRun, at: number, endReason: EndReason, crossings = run.crossings): FinishedRun {
  return {
    ...run,
    status: "finished",
    crossings,
    gaps: closeGaps(run.gaps, at),
    lastEventAt: at,
    endedAt: at,
    endReason,
  };
}

// Returns the same object when an event doesn't apply, so callers can tell nothing changed.
export function reduce(run: Run, event: TimingEvent): Run {
  if (event.type === "reset") return run.status === "idle" ? run : IDLE;
  if (event.type === "start") {
    if (run.status === "running") return run;
    return {
      status: "running",
      id: event.id,
      config: event.config,
      startedAt: event.at,
      crossings: [],
      penalties: [],
      gaps: [],
      lastEventAt: event.at,
    };
  }
  if (run.status !== "running") return run;

  const lastCrossing = run.crossings.length > 0 ? run.crossings[run.crossings.length - 1] : run.startedAt;
  switch (event.type) {
    case "lap":
    case "finish": {
      // Never before the previous crossing (a late sensor callback can't make a negative lap).
      const at = Math.max(event.at, lastCrossing);
      const crossings = [...run.crossings, at];
      const { lapTarget } = run.config;
      if (event.type === "finish") return finished(run, at, "finish", crossings);
      if (lapTarget !== "unlimited" && crossings.length >= lapTarget) return finished(run, at, "target", crossings);
      return { ...run, crossings, lastEventAt: at };
    }
    case "penalty": {
      const lapNumber = run.crossings.length + 1;
      const existing = run.penalties.find((p) => p.lapNumber === lapNumber);
      const penalties = existing
        ? run.penalties.map((p) => (p.lapNumber === lapNumber ? { ...p, count: p.count + 1 } : p))
        : [...run.penalties, { lapNumber, count: 1 }];
      return { ...run, penalties, lastEventAt: event.at };
    }
    case "end":
      return finished(run, Math.max(event.at, lastCrossing), "end");
    case "hidden":
      if (run.gaps.some((gap) => gap.to === null)) return run;
      return { ...run, gaps: [...run.gaps, { from: event.at, to: null }], lastEventAt: event.at };
    case "visible":
      if (!run.gaps.some((gap) => gap.to === null)) return run;
      return { ...run, gaps: closeGaps(run.gaps, event.at), lastEventAt: event.at };
    case "resume": {
      // If the page went away without a "hidden" event, count the time since the last event.
      const gaps = run.gaps.some((gap) => gap.to === null)
        ? closeGaps(run.gaps, event.at)
        : [...run.gaps, { from: run.lastEventAt, to: event.at }];
      return { ...run, gaps, lastEventAt: event.at };
    }
  }
}

// ---- Selectors ----

export function lapTimes(run: Run): number[] {
  if (run.status === "idle") return [];
  return run.crossings.map((at, i) => at - (i === 0 ? run.startedAt : run.crossings[i - 1]));
}

export function elapsed(run: Run, at: number): number {
  if (run.status === "idle") return 0;
  return Math.max(0, (run.status === "finished" ? run.endedAt : at) - run.startedAt);
}

export function currentLapElapsed(run: Run, at: number): number {
  if (run.status !== "running") return 0;
  const lapStart = run.crossings.length > 0 ? run.crossings[run.crossings.length - 1] : run.startedAt;
  return Math.max(0, at - lapStart);
}

export function currentLapNumber(run: Run): number {
  return run.status === "idle" ? 0 : run.crossings.length + 1;
}

export function gapTotal(run: Run, at: number): number {
  if (run.status === "idle") return 0;
  return run.gaps.reduce((sum, gap) => sum + ((gap.to ?? at) - gap.from), 0);
}

export interface SessionPayload {
  id: string;
  date: string;
  driverId: string;
  driverName: string;
  carId: string;
  carName: string;
  locationId: string;
  locationName: string;
  laps: { lapNumber: number; lapTime: number }[];
  penalties: PenaltyData[];
  totalLaps: number;
  stats: LapStats;
}

// What /api/data saves for a finished run. Penalties on a lap that was dropped (Stop in a sensor mode) are left out.
export function toSessionPayload(run: FinishedRun): SessionPayload {
  const times = lapTimes(run).map((time) => Math.round(time));
  const penalties = run.penalties.filter((p) => p.lapNumber <= times.length);
  const { config } = run;
  return {
    id: run.id,
    date: new Date(run.startedAt).toISOString(),
    driverId: config.driverId,
    driverName: config.driverName,
    carId: config.carId,
    carName: config.carName,
    locationId: config.locationId,
    locationName: config.locationName,
    laps: times.map((lapTime, i) => ({ lapNumber: i + 1, lapTime })),
    penalties,
    totalLaps: config.lapTarget === "unlimited" ? times.length : config.lapTarget,
    stats: lapStats(times, penalties),
  };
}
