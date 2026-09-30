// Setting the timer's clock from the phones and browsers that use it. The Pi has no clock battery and no internet, so
// after being switched off its clock is behind, and everything it saves is dated in the past: an edit made on the
// timer could lose a sync to an older edit made on a phone. Every edit on the timer comes from a device viewing its
// pages, and those devices know the time, so they tell the timer as they open (POST /api/sync/clock), and so does the
// phone app when it syncs.
//
// The clock only moves forward, once per boot, and not while a race is on, whose lap times come from the timer's
// clock. The helper that sets it (scripts/system/rc-config-helper.sh) insists on the first two itself.
import { uptime } from "os";
import { helperInstalled, helperOutdated, runHelper } from "@/lib/config-helper";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

// Clocks this close are left alone.
export const CLOSE_ENOUGH_MS = 2 * 60_000;

export type ClockReason = "close" | "behind" | "race" | "set" | "already-set" | "unavailable";

export interface ClockAnswer {
  changed: boolean;
  reason: ClockReason;
}

// How a device's clock compares with the timer's.
export function compareClocks(deviceNow: number, timerNow: number): "close" | "behind" | "ahead" {
  if (Math.abs(deviceNow - timerNow) <= CLOSE_ENOUGH_MS) return "close";
  return deviceNow < timerNow ? "behind" : "ahead";
}

// Once the helper has answered, the clock is set (or can't be) until the next boot.
let settled = false;
let queue: Promise<unknown> = Promise.resolve();

// One at a time, so two devices opening the timer together don't both set it.
export function syncClock(deviceNow: number): Promise<ClockAnswer> {
  const answer = queue.then(() => setClockFrom(deviceNow));
  queue = answer.catch(() => undefined);
  return answer;
}

async function setClockFrom(deviceNow: number): Promise<ClockAnswer> {
  if (settled) return { changed: false, reason: "already-set" };
  const timerNow = Date.now();
  const comparison = compareClocks(deviceNow, timerNow);
  if (comparison !== "ahead") return { changed: false, reason: comparison };
  if (await raceRunning(timerNow)) return { changed: false, reason: "race" };
  if (!(await helperInstalled())) return { changed: false, reason: "unavailable" };

  try {
    const said = await runHelper(["set-clock", String(Math.floor(deviceNow / 1000))]);
    settled = true;
    if (said !== "Clock set") return { changed: false, reason: said.includes("already set") ? "already-set" : "close" };
    logger.info(
      `[clock] set the timer's clock from ${new Date(timerNow).toISOString()} to ${new Date(deviceNow).toISOString()}`,
    );
    return { changed: true, reason: "set" };
  } catch (error) {
    // Not asked again until the app restarts, which an upgrade (with its new helper) does.
    settled = true;
    logger.warn(
      helperOutdated(error)
        ? "[clock] the configuration helper is out of date, so the clock can't be set: run the upgrade"
        : `[clock] couldn't set the clock: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { changed: false, reason: "unavailable" };
  }
}

// A race started or changed since the timer was switched on. Nothing ends a race whose phone went away, so one left
// running from before is ignored.
async function raceRunning(timerNow: number): Promise<boolean> {
  const bootedAt = new Date(timerNow - uptime() * 1000);
  const races = await prisma.race.count({
    where: { status: { in: ["COUNTDOWN", "RACING", "PAUSED"] }, updatedAt: { gte: bootedAt } },
  });
  return races > 0;
}
