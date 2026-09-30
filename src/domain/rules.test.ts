import { describe, expect, it } from "vitest";
import {
  checkMotionSettings,
  cleanCarNumber,
  cleanName,
  cleanNotes,
  duplicateNameMessage,
  isUuid,
  MAX_NAME_LENGTH,
  sameName,
} from "./rules";

describe("cleanName", () => {
  it("trims names", () => {
    expect(cleanName("  Kris ", "driver")).toEqual({ ok: true, value: "Kris" });
  });

  it.each([[""], ["   "], [undefined], [42]])("rejects %j", (value) => {
    expect(cleanName(value, "location")).toEqual({ ok: false, error: "Location name is required" });
  });

  it("allows up to 191 characters", () => {
    expect(cleanName("x".repeat(MAX_NAME_LENGTH), "car").ok).toBe(true);
    expect(cleanName("x".repeat(MAX_NAME_LENGTH + 1), "car")).toEqual({
      ok: false,
      error: "Car name must be 191 characters or fewer",
    });
  });
});

describe("names", () => {
  it("match ignoring case and surrounding spaces", () => {
    expect(sameName("Back Yard", " back yard ")).toBe(true);
    expect(sameName("Back Yard", "Backyard")).toBe(false);
  });

  it("have clear duplicate messages", () => {
    expect(duplicateNameMessage("driver", "Kris")).toBe('A driver named "Kris" already exists');
    expect(duplicateNameMessage("motionSetting", "Sunny")).toBe('A motion setting named "Sunny" already exists');
    expect(duplicateNameMessage("car", "Slash")).toBe('This driver already has a car named "Slash"');
  });
});

describe("cleanCarNumber", () => {
  it.each([
    [7, 7],
    [0, null],
    [-1, null],
    [2.5, null],
    ["7", null],
    [null, null],
    [undefined, null],
  ])("%j becomes %j", (value, expected) => {
    expect(cleanCarNumber(value)).toBe(expected);
  });
});

describe("isUuid", () => {
  it("accepts UUIDs only", () => {
    expect(isUuid("0f8fad5b-d9cb-469f-a165-70867728950e")).toBe(true);
    expect(isUuid("1727712000000")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});

describe("cleanNotes", () => {
  it("stores empty notes as none", () => {
    expect(cleanNotes("")).toEqual({ ok: true, value: null });
    expect(cleanNotes(null)).toEqual({ ok: true, value: null });
    expect(cleanNotes("Loose rear wheel")).toEqual({ ok: true, value: "Loose rear wheel" });
    expect(cleanNotes(5).ok).toBe(false);
  });
});

describe("checkMotionSettings", () => {
  const valid = { name: " Sunny ", sensitivity: 50, threshold: 1.5, cooldown: 1000, framesToSkip: 10 };

  it("accepts settings in range and trims the name", () => {
    expect(checkMotionSettings(valid)).toEqual({ ok: true, value: { ...valid, name: "Sunny" } });
  });

  it("accepts the edges of every range", () => {
    expect(checkMotionSettings({ ...valid, sensitivity: 5, threshold: 0.1, cooldown: 100, framesToSkip: 1 }).ok).toBe(
      true,
    );
    expect(
      checkMotionSettings({ ...valid, sensitivity: 200, threshold: 10, cooldown: 25000, framesToSkip: 240 }).ok,
    ).toBe(true);
  });

  it("lists every problem", () => {
    const result = checkMotionSettings({ name: "", sensitivity: 4, threshold: "1", cooldown: 99.5, framesToSkip: 0 });
    expect(result).toEqual({
      ok: false,
      errors: [
        "Motion setting name is required",
        "Sensitivity must be an integer between 5 and 200",
        "Threshold must be a number between 0.1 and 10.0",
        "Cooldown must be an integer between 100 and 25000",
        "Frames to skip must be an integer between 1 and 240",
      ],
    });
  });

  it("rejects a body that isn't an object", () => {
    expect(checkMotionSettings(null).ok).toBe(false);
  });
});
