import type { LapStats, PenaltyData, Session } from "./types";

export const EMPTY_LAP_STATS: LapStats = {
  average: 0,
  totalTime: 0,
  bestLap: 0,
  worstLap: 0,
  maxPenaltyLap: null,
  maxPenaltyCount: 0,
  totalPenalties: 0,
};

// Stats for a list of lap times (ms). Penalties only count when there is at least one lap; the lap with the most
// penalties is the first one to reach the highest count.
export function lapStats(lapTimes: number[], penalties: PenaltyData[] = []): LapStats {
  const times = lapTimes.filter((time) => typeof time === "number" && Number.isFinite(time));
  if (times.length === 0) return { ...EMPTY_LAP_STATS };

  const totalTime = times.reduce((sum, time) => sum + time, 0);
  let maxPenaltyLap: number | null = null;
  let maxPenaltyCount = 0;
  let totalPenalties = 0;
  for (const penalty of penalties) {
    if (!(penalty.count > 0)) continue;
    totalPenalties += penalty.count;
    if (penalty.count > maxPenaltyCount) {
      maxPenaltyCount = penalty.count;
      maxPenaltyLap = penalty.lapNumber;
    }
  }

  return {
    average: totalTime / times.length,
    totalTime,
    bestLap: Math.min(...times),
    worstLap: Math.max(...times),
    maxPenaltyLap,
    maxPenaltyCount,
    totalPenalties,
  };
}

// Stats for a saved session. Laps without a numeric lap time are skipped.
export function sessionStats(session: Pick<Session, "laps" | "penalties">): LapStats {
  const lapTimes = (Array.isArray(session.laps) ? session.laps : [])
    .filter((lap) => lap && typeof lap.lapTime === "number")
    .map((lap) => lap.lapTime);
  return lapStats(lapTimes, Array.isArray(session.penalties) ? session.penalties : []);
}

// The fastest lap and its 1-based number (the first one, if two are equal).
export function bestLap(lapTimes: number[]): { time: number; lapNumber: number } | null {
  if (lapTimes.length === 0) return null;
  const time = Math.min(...lapTimes);
  return { time, lapNumber: lapTimes.indexOf(time) + 1 };
}
