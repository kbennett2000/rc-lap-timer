import { describe, expect, it } from "vitest";
import { DATE_PRESETS, describeRange, isWithinRange, presetRange, todayRange } from "./date-range";

// Local time, mid-afternoon on Wednesday 2026-09-30.
const now = new Date(2026, 8, 30, 15, 45);
const preset = (label: string) => DATE_PRESETS.find((p) => p.label === label)!;
const local = (y: number, m: number, d: number, h = 0, min = 0, s = 0, ms = 0) => new Date(y, m - 1, d, h, min, s, ms);

describe("presetRange", () => {
  it("Today covers the whole day", () => {
    expect(presetRange(preset("Today"), now)).toEqual({
      from: local(2026, 9, 30),
      to: local(2026, 9, 30, 23, 59, 59, 999),
    });
  });

  it("Last 7 days starts at the beginning of the day a week ago", () => {
    expect(presetRange(preset("Last 7 days"), now).from).toEqual(local(2026, 9, 23));
  });

  it("This month and This year start on the 1st", () => {
    expect(presetRange(preset("This month"), now).from).toEqual(local(2026, 9, 1));
    expect(presetRange(preset("This year"), now).from).toEqual(local(2026, 1, 1));
  });

  it("all presets end at the end of today", () => {
    for (const p of DATE_PRESETS) expect(presetRange(p, now).to).toEqual(local(2026, 9, 30, 23, 59, 59, 999));
  });
});

describe("isWithinRange", () => {
  const range = { from: local(2026, 9, 10, 15), to: local(2026, 9, 20, 9) };

  it("matches everything when there is no range", () => {
    expect(isWithinRange("2020-01-01T00:00:00Z", { from: undefined, to: undefined })).toBe(true);
  });

  it("counts both end days in full", () => {
    expect(isWithinRange(local(2026, 9, 10, 0, 0, 1).toISOString(), range)).toBe(true);
    expect(isWithinRange(local(2026, 9, 20, 23, 59).toISOString(), range)).toBe(true);
    expect(isWithinRange(local(2026, 9, 9, 23, 59).toISOString(), range)).toBe(false);
    expect(isWithinRange(local(2026, 9, 21, 0, 0, 1).toISOString(), range)).toBe(false);
  });

  it("supports open-ended ranges", () => {
    expect(isWithinRange(local(2030, 1, 1).toISOString(), { from: range.from, to: undefined })).toBe(true);
    expect(isWithinRange(local(2000, 1, 1).toISOString(), { from: undefined, to: range.to })).toBe(true);
  });

  it("rejects missing or invalid dates when a range is set", () => {
    expect(isWithinRange(null, range)).toBe(false);
    expect(isWithinRange("not a date", range)).toBe(false);
  });
});

describe("describeRange", () => {
  it("names today, spans and open ends", () => {
    expect(describeRange(todayRange(now), now)).toBe("Showing sessions from today");
    expect(describeRange({ from: local(2026, 9, 1), to: local(2026, 9, 2) }, now)).toBe(
      "Showing sessions from September 1st, 2026 to September 2nd, 2026",
    );
    expect(describeRange({ from: undefined, to: local(2026, 9, 2) }, now)).toBe(
      "Showing sessions until September 2nd, 2026",
    );
    expect(describeRange({ from: undefined, to: undefined }, now)).toBeNull();
  });
});
