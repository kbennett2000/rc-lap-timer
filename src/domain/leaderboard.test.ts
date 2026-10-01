import { describe, expect, it } from "vitest";
import { cleanTrack, entryForSession } from "./leaderboard";
import type { SessionRecord } from "./types";

const session = (laps: number[], penalties: { lapNumber: number; count: number }[] = []): SessionRecord => ({
  id: "6f9c1a52-3a0e-4b8c-9d43-1f2e3d4c5b6a",
  date: "2026-09-30T12:00:00.000Z",
  driverId: "d",
  driverName: "Amy",
  carId: "c",
  carName: "Slash",
  locationId: "l",
  locationName: "Backyard",
  laps: laps.map((lapTime, i) => ({ lapNumber: i + 1, lapTime })),
  penalties,
  totalTime: laps.reduce((a, b) => a + b, 0),
  totalLaps: laps.length,
  notes: null,
  createdAt: "2026-09-30T12:00:00.000Z",
  updatedAt: "2026-09-30T12:00:00.000Z",
});

describe("entryForSession", () => {
  it("takes the session's fastest lap, with its number and penalties", () => {
    expect(entryForSession(session([12000, 11000, 11500], [{ lapNumber: 2, count: 1 }]))).toEqual({
      sessionId: "6f9c1a52-3a0e-4b8c-9d43-1f2e3d4c5b6a",
      driverName: "Amy",
      carName: "Slash",
      bestLapMs: 11000,
      bestLapNumber: 2,
      penalties: 1,
      lapCount: 3,
      sessionDate: "2026-09-30T12:00:00.000Z",
    });
  });

  it("takes the first of two equal laps, and rounds to whole milliseconds", () => {
    expect(entryForSession(session([11000.4, 11000.4]))).toMatchObject({ bestLapMs: 11000, bestLapNumber: 1 });
  });

  it("goes by lap number, whatever order the laps are stored in", () => {
    const stored = session([12000, 11000]);
    stored.laps.reverse();
    expect(entryForSession(stored)).toMatchObject({ bestLapNumber: 2, lapCount: 2 });
  });

  it("has nothing to post without a lap that took some time", () => {
    expect(entryForSession(session([]))).toBeNull();
    expect(entryForSession(session([0]))).toBeNull();
    expect(entryForSession(session([0, 9000]))).toMatchObject({ bestLapMs: 9000, bestLapNumber: 2 });
  });
});

describe("cleanTrack", () => {
  it("trims the name and area, and the area is optional", () => {
    expect(cleanTrack("  Backyard Oval ", " Austin, TX ")).toEqual({
      ok: true,
      value: { name: "Backyard Oval", area: "Austin, TX" },
    });
    expect(cleanTrack("Garage", "")).toEqual({ ok: true, value: { name: "Garage", area: "" } });
  });

  it("needs a name, and keeps both to 80 characters", () => {
    expect(cleanTrack("  ", "Austin")).toMatchObject({ ok: false });
    expect(cleanTrack("x".repeat(80), "y".repeat(80)).ok).toBe(true);
    expect(cleanTrack("x".repeat(81), "")).toMatchObject({ ok: false });
    expect(cleanTrack("Garage", "y".repeat(81))).toMatchObject({ ok: false });
  });
});
