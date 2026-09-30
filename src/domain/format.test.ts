import { describe, expect, it } from "vitest";
import { formatLapTime, formatLapTimeForSpeech } from "./format";

describe("formatLapTime", () => {
  it.each([
    [0, "00:00.000"],
    [1234, "00:01.234"],
    [61_005, "01:01.005"],
    [59_999.9, "00:59.999"],
    [3_600_000, "60:00.000"],
  ])("formats %d ms as %s", (ms, expected) => {
    expect(formatLapTime(ms)).toBe(expected);
  });
});

describe("formatLapTimeForSpeech", () => {
  it.each([
    [12_345, "12 point 34"],
    [5_050, "5 point 05"],
    [61_000, "1 minute, 1 point 00"],
    [125_990, "2 minutes, 5 point 99"],
  ])("says %d ms as %j", (ms, expected) => {
    expect(formatLapTimeForSpeech(ms)).toBe(expected);
  });
});
