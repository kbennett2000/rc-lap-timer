// Validation for a finished practice session posted to /api/data. Pure, so it can be unit tested.

export interface SessionInput {
  id: string;
  date: Date;
  driverId: string;
  carId: string;
  locationId: string;
  laps: { lapNumber: number; lapTime: number }[];
  penalties: { lapNumber: number; count: number }[];
}

export type ParseResult = { ok: true; session: SessionInput } | { ok: false; error: string };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// Laps may be numbers (lap times in ms) or { lapNumber, lapTime } objects. Lap times are rounded to whole ms.
// Penalties that aren't a positive whole count on a whole lap number are dropped.
export function parseSessionInput(input: unknown): ParseResult {
  if (!isRecord(input) || !isNonEmptyString(input.id)) return { ok: false, error: "Session id is required" };
  const { id, driverId, carId, locationId } = input;
  if (!isNonEmptyString(driverId) || !isNonEmptyString(carId) || !isNonEmptyString(locationId)) {
    return { ok: false, error: "Session driverId, carId and locationId are required" };
  }
  const date = new Date(input.date as string | number);
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Session date is invalid" };
  if (!Array.isArray(input.laps)) return { ok: false, error: "Session laps must be an array" };

  const laps = input.laps.map((lap: unknown, index: number) => ({
    lapNumber: isRecord(lap) && Number.isInteger(lap.lapNumber) ? (lap.lapNumber as number) : index + 1,
    lapTime: Math.round(Number(isRecord(lap) ? lap.lapTime : lap)),
  }));
  if (laps.some((lap) => !Number.isFinite(lap.lapTime) || lap.lapTime < 0)) {
    return { ok: false, error: "Every lap needs a lap time of 0 ms or more" };
  }

  const penalties = (Array.isArray(input.penalties) ? input.penalties : [])
    .filter(
      (penalty: unknown): penalty is { lapNumber: number; count: number } =>
        isRecord(penalty) &&
        Number.isInteger(penalty.lapNumber) &&
        Number.isInteger(penalty.count) &&
        (penalty.count as number) > 0,
    )
    .map((penalty) => ({ lapNumber: penalty.lapNumber, count: penalty.count }));

  return { ok: true, session: { id, date, driverId, carId, locationId, laps, penalties } };
}
