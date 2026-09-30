import { describe, expect, it } from "vitest";
import { bestLap, EMPTY_LAP_STATS, lapStats, sessionStats } from "./stats";

describe("lapStats", () => {
  it("returns zeros for no laps, even with penalties", () => {
    expect(lapStats([], [{ lapNumber: 1, count: 2 }])).toEqual(EMPTY_LAP_STATS);
  });

  it("computes total, average, best and worst", () => {
    expect(lapStats([12_000, 10_000, 14_000])).toMatchObject({
      totalTime: 36_000,
      average: 12_000,
      bestLap: 10_000,
      worstLap: 14_000,
    });
  });

  it("totals penalties and finds the first lap with the most", () => {
    const stats = lapStats(
      [1000, 1000, 1000],
      [
        { lapNumber: 1, count: 1 },
        { lapNumber: 2, count: 3 },
        { lapNumber: 3, count: 3 },
        { lapNumber: 4, count: 0 },
      ],
    );
    expect(stats).toMatchObject({ totalPenalties: 7, maxPenaltyLap: 2, maxPenaltyCount: 3 });
  });

  it("ignores lap times that aren't finite numbers", () => {
    expect(lapStats([1000, Number.NaN, 3000]).average).toBe(2000);
  });
});

describe("sessionStats", () => {
  it("skips laps without a numeric time", () => {
    const laps = [
      { lapNumber: 1, lapTime: 2000 },
      { lapNumber: 2, lapTime: null as unknown as number },
      { lapNumber: 3, lapTime: 4000 },
    ];
    expect(sessionStats({ laps, penalties: [] })).toMatchObject({ totalTime: 6000, bestLap: 2000, worstLap: 4000 });
  });

  it("copes with missing penalties", () => {
    const session = { laps: [{ lapNumber: 1, lapTime: 1000 }], penalties: undefined as never };
    expect(sessionStats(session).totalPenalties).toBe(0);
  });
});

describe("bestLap", () => {
  it("finds the first fastest lap", () => {
    expect(bestLap([3000, 2000, 2000])).toEqual({ time: 2000, lapNumber: 2 });
    expect(bestLap([])).toBeNull();
  });
});
