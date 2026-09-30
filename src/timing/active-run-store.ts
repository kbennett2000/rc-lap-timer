import type { Run, RunningRun } from "./engine";

// The running session, checkpointed after every event so it survives a reload, a crash or iOS discarding the tab.
// localStorage rather than IndexedDB: the write is synchronous, so a lap tapped just before the page dies is kept.
export const ACTIVE_RUN_KEY = "rc-lap-timer-active-run:v1";

type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): KeyValueStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null; // storage blocked (private mode, site data disabled)
  }
}

export function saveActiveRun(run: Run, storage: KeyValueStorage | null = defaultStorage()): void {
  if (!storage) return;
  try {
    if (run.status === "running") storage.setItem(ACTIVE_RUN_KEY, JSON.stringify(run));
    else storage.removeItem(ACTIVE_RUN_KEY);
  } catch {
    // Quota or blocked storage: timing carries on, only crash recovery is lost.
  }
}

const isNumberArray = (value: unknown) => Array.isArray(value) && value.every((n) => typeof n === "number");

function isRunningRun(value: unknown): value is RunningRun {
  if (typeof value !== "object" || value === null) return false;
  const run = value as Record<string, unknown>;
  const config = run.config as Record<string, unknown> | undefined;
  return (
    run.status === "running" &&
    typeof run.id === "string" &&
    typeof run.startedAt === "number" &&
    typeof run.lastEventAt === "number" &&
    isNumberArray(run.crossings) &&
    Array.isArray(run.penalties) &&
    Array.isArray(run.gaps) &&
    typeof config === "object" &&
    config !== null &&
    typeof config.driverId === "string" &&
    typeof config.carId === "string" &&
    typeof config.locationId === "string" &&
    ["manual", "motion", "ir"].includes(config.timingMode as string)
  );
}

// The checkpointed run, or null. Anything unreadable is removed so it can't block the next session.
export function loadActiveRun(storage: KeyValueStorage | null = defaultStorage()): RunningRun | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(ACTIVE_RUN_KEY);
    if (!raw) return null;
    const run = JSON.parse(raw);
    if (isRunningRun(run)) return run;
  } catch {
    // fall through
  }
  try {
    storage.removeItem(ACTIVE_RUN_KEY);
  } catch {
    // ignore
  }
  return null;
}
