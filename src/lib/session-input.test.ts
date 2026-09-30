import { describe, expect, it } from "vitest";
import { parseSessionInput } from "./session-input";

const valid = {
  id: "0b7c4f0e-4d1a-4a4e-9b0a-2f3c5d6e7f80",
  date: "2026-09-30T12:00:00.000Z",
  driverId: "driver-1",
  carId: "car-1",
  locationId: "location-1",
  laps: [{ lapNumber: 1, lapTime: 12345 }],
  penalties: [],
};

function parse(overrides: Record<string, unknown>) {
  return parseSessionInput({ ...valid, ...overrides });
}

describe("parseSessionInput", () => {
  it("accepts a valid session", () => {
    const result = parseSessionInput(valid);
    expect(result).toEqual({
      ok: true,
      session: { ...valid, date: new Date(valid.date), laps: [{ lapNumber: 1, lapTime: 12345 }], penalties: [] },
    });
  });

  it.each([null, "session", 42])("rejects a non-object body (%j)", (input) => {
    expect(parseSessionInput(input)).toEqual({ ok: false, error: "Session id is required" });
  });

  it("requires an id", () => {
    expect(parse({ id: "" })).toEqual({ ok: false, error: "Session id is required" });
  });

  it.each(["driverId", "carId", "locationId"])("requires %s", (field) => {
    expect(parse({ [field]: undefined })).toEqual({
      ok: false,
      error: "Session driverId, carId and locationId are required",
    });
  });

  it("rejects an invalid date", () => {
    expect(parse({ date: "not a date" })).toEqual({ ok: false, error: "Session date is invalid" });
  });

  it("requires laps to be an array", () => {
    expect(parse({ laps: "3" })).toEqual({ ok: false, error: "Session laps must be an array" });
  });

  it("accepts a session with no laps", () => {
    const result = parse({ laps: [] });
    expect(result.ok && result.session.laps).toEqual([]);
  });

  it("accepts bare lap times and numbers them in order", () => {
    const result = parse({ laps: [1000, 2000.4] });
    expect(result.ok && result.session.laps).toEqual([
      { lapNumber: 1, lapTime: 1000 },
      { lapNumber: 2, lapTime: 2000 },
    ]);
  });

  it("rounds lap times to whole milliseconds", () => {
    const result = parse({ laps: [{ lapNumber: 1, lapTime: 999.6 }] });
    expect(result.ok && result.session.laps[0].lapTime).toBe(1000);
  });

  it.each([[-1], [Number.NaN], [Number.POSITIVE_INFINITY], ["1000"], [""], [null], [true], [undefined]])(
    "rejects lap time %j",
    (lapTime) => {
      expect(parse({ laps: [{ lapNumber: 1, lapTime }] })).toEqual({
        ok: false,
        error: "Every lap needs a lap time of 0 ms or more",
      });
    },
  );

  it("rejects a bare lap time that isn't a number", () => {
    expect(parse({ laps: [1000, null] })).toEqual({ ok: false, error: "Every lap needs a lap time of 0 ms or more" });
  });

  it("keeps only whole, positive penalty counts", () => {
    const result = parse({
      penalties: [
        { lapNumber: 1, count: 2 },
        { lapNumber: 2, count: 0 },
        { lapNumber: 3, count: -1 },
        { lapNumber: 4.5, count: 1 },
        { lapNumber: 5, count: "1" },
        null,
      ],
    });
    expect(result.ok && result.session.penalties).toEqual([{ lapNumber: 1, count: 2 }]);
  });

  it("treats missing penalties as none", () => {
    const result = parse({ penalties: undefined });
    expect(result.ok && result.session.penalties).toEqual([]);
  });
});
