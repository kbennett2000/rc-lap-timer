// Data rules every store follows: the Pi's API routes now, the phone's on-device store later. Pure, so both share them.

// The Pi's name columns are VARCHAR(191).
export const MAX_NAME_LENGTH = 191;

export type EntityKind = "driver" | "car" | "location" | "motionSetting";

const LABELS: Record<EntityKind, string> = {
  driver: "Driver",
  car: "Car",
  location: "Location",
  motionSetting: "Motion setting",
};

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

// Names are trimmed and must be 1 to 191 characters.
export function cleanName(value: unknown, kind: EntityKind): Checked<string> {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name) return { ok: false, error: `${LABELS[kind]} name is required` };
  if (name.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `${LABELS[kind]} name must be ${MAX_NAME_LENGTH} characters or fewer` };
  }
  return { ok: true, value: name };
}

// Names are unique ignoring case, accents and surrounding spaces (car names per driver), like the Pi's database
// collation: "José " and "jose" are the same name. This is the form they're compared in. toLowerCase, not
// toLocaleLowerCase, so the result doesn't depend on the phone's language.
export function nameKey(name: string): string {
  return name
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function sameName(a: string, b: string): boolean {
  return nameKey(a) === nameKey(b);
}

export function duplicateNameMessage(kind: EntityKind, name: string): string {
  if (kind === "car") return `This driver already has a car named "${name}"`;
  return `A ${LABELS[kind].toLowerCase()} named "${name}" already exists`;
}

// A car's default number for IR timing: a positive whole number, or none.
export function cleanCarNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Ids made on the device that creates a record (see newId in src/lib/utils.ts).
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

// Notes are free text; an empty note is stored as none.
export function cleanNotes(value: unknown): Checked<string | null> {
  if (value === null || value === undefined || value === "") return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: "Notes must be text" };
  return { ok: true, value };
}

export interface MotionSettingsInput {
  name: string;
  sensitivity: number;
  threshold: number;
  cooldown: number;
  framesToSkip: number;
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

// Motion detector settings, checked field by field because they arrive as untrusted JSON.
export function checkMotionSettings(
  data: unknown,
): { ok: true; value: MotionSettingsInput } | { ok: false; errors: string[] } {
  const input = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
  const errors: string[] = [];

  const name = cleanName(input.name, "motionSetting");
  if (!name.ok) errors.push(name.error);
  if (!isIntegerInRange(input.sensitivity, 5, 200)) {
    errors.push("Sensitivity must be an integer between 5 and 200");
  }
  if (typeof input.threshold !== "number" || !(input.threshold >= 0.1 && input.threshold <= 10)) {
    errors.push("Threshold must be a number between 0.1 and 10.0");
  }
  if (!isIntegerInRange(input.cooldown, 100, 25000)) {
    errors.push("Cooldown must be an integer between 100 and 25000");
  }
  if (!isIntegerInRange(input.framesToSkip, 1, 240)) {
    errors.push("Frames to skip must be an integer between 1 and 240");
  }

  if (!name.ok || errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name: name.value,
      sensitivity: input.sensitivity as number,
      threshold: input.threshold as number,
      cooldown: input.cooldown as number,
      framesToSkip: input.framesToSkip as number,
    },
  };
}
