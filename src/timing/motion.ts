// The camera's motion check: how much of the picture changed since the last frame, and when that counts as the car
// crossing the line. It's pure, so it's tested on made-up frames (motion.test.ts); the motion detector
// (src/components/rc-timer/motion-detector.tsx) feeds it the camera's frames.

export interface DetectorSettings {
  // How much a pixel's red, green or blue must change (0-255) for the pixel to count as changed.
  sensitivity: number;
  // The percentage of the picture that must change for a crossing.
  threshold: number;
  // Milliseconds after a crossing in which another doesn't count (the same car, still passing).
  cooldown: number;
  // Frames ignored after the camera starts, while it settles.
  framesToSkip: number;
}

export const DEFAULT_SETTINGS: DetectorSettings = {
  sensitivity: 100,
  threshold: 1.0,
  cooldown: 10000,
  framesToSkip: 60,
};

// What each setting's slider allows.
export const SETTING_RANGES: Record<keyof DetectorSettings, readonly [number, number]> = {
  sensitivity: [5, 200],
  threshold: [0.1, 10],
  cooldown: [100, 25000],
  framesToSkip: [1, 240],
};

// Settings read back from the device's storage. Anything missing or outside its slider's range (a different
// version, or a hand edit) gets its default.
export function parseSettings(value: unknown): DetectorSettings {
  const stored = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const setting = (key: keyof DetectorSettings) => {
    const [min, max] = SETTING_RANGES[key];
    const number = stored[key];
    return typeof number === "number" && number >= min && number <= max ? number : DEFAULT_SETTINGS[key];
  };
  return {
    sensitivity: setting("sensitivity"),
    threshold: setting("threshold"),
    cooldown: setting("cooldown"),
    framesToSkip: setting("framesToSkip"),
  };
}

// Frames are compared at this size (the longest side, in pixels): small enough for a phone to compare every frame, and
// still hundreds of pixels for a car crossing the picture. A smaller picture also averages away the camera's grain.
export const ANALYSIS_SIZE = 320;

// The size to compare a width × height camera frame at, keeping its shape and never enlarging it.
export function analysisSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, ANALYSIS_SIZE / Math.max(width, height, 1));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// The start/finish box: the part of the camera's picture that's compared, so a car only counts at the line and
// everything else in view (people, trees, other cars) is ignored. Fractions (0-1) of the frame's width and height, in
// the camera's own orientation, whatever way the preview is rotated.
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

// A box must be at least this share of the picture each way, so a tap doesn't make one.
export const MIN_BOX_SIZE = 0.05;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

// A box read back from the device's storage, or null if it isn't one.
export function parseBox(value: unknown): Box | null {
  if (typeof value !== "object" || value === null) return null;
  const { x, y, width, height } = value as Record<string, unknown>;
  const numbers = [x, y, width, height];
  if (!numbers.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  const box = { x, y, width, height } as Box;
  const fits =
    box.x >= 0 &&
    box.y >= 0 &&
    box.width >= MIN_BOX_SIZE &&
    box.height >= MIN_BOX_SIZE &&
    box.x + box.width <= 1 + 1e-9 &&
    box.y + box.height <= 1 + 1e-9;
  return fits ? box : null;
}

// The box between two corners of a drag (each 0-1, and kept inside the picture), or null if it's too small.
export function boxFromCorners(a: Point, b: Point): Box | null {
  const left = clamp01(Math.min(a.x, b.x));
  const top = clamp01(Math.min(a.y, b.y));
  const width = clamp01(Math.max(a.x, b.x)) - left;
  const height = clamp01(Math.max(a.y, b.y)) - top;
  return width >= MIN_BOX_SIZE && height >= MIN_BOX_SIZE ? { x: left, y: top, width, height } : null;
}

// The box in a width × height frame's pixels (the whole frame without one): whole pixels, at least one each way.
export function boxPixels(box: Box | null, width: number, height: number) {
  if (!box) return { x: 0, y: 0, width, height };
  const x = Math.min(width - 1, Math.max(0, Math.round(box.x * width)));
  const y = Math.min(height - 1, Math.max(0, Math.round(box.y * height)));
  return {
    x,
    y,
    width: Math.max(1, Math.min(width - x, Math.round(box.width * width))),
    height: Math.max(1, Math.min(height - y, Math.round(box.height * height))),
  };
}

// Where a point on the screen is in the camera's picture (0-1 each way). The preview is rotated `rotation` degrees
// clockwise (0, 90, 180 or 270) about its centre, and `rect` is where it is on the screen once rotated (its
// getBoundingClientRect).
export function toFramePoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  rotation: number,
): Point {
  const sideways = rotation % 180 !== 0;
  // The preview's own size, before rotating.
  const width = sideways ? rect.height : rect.width;
  const height = sideways ? rect.width : rect.height;
  const dx = clientX - (rect.left + rect.width / 2);
  const dy = clientY - (rect.top + rect.height / 2);
  // Undo the rotation.
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.round(Math.cos(radians));
  const sin = Math.round(Math.sin(radians));
  const x = dx * cos + dy * sin;
  const y = -dx * sin + dy * cos;
  return { x: clamp01((x + width / 2) / width), y: clamp01((y + height / 2) / height) };
}

// The percentage of pixels whose red, green or blue changed by more than `sensitivity`, between two RGBA frames of
// the same size.
export function changedPercent(previous: Uint8ClampedArray, current: Uint8ClampedArray, sensitivity: number): number {
  const length = Math.min(previous.length, current.length);
  let changed = 0;
  for (let i = 0; i < length; i += 4) {
    if (
      Math.abs(current[i] - previous[i]) > sensitivity ||
      Math.abs(current[i + 1] - previous[i + 1]) > sensitivity ||
      Math.abs(current[i + 2] - previous[i + 2]) > sensitivity
    ) {
      changed++;
    }
  }
  const pixels = length / 4;
  return pixels === 0 ? 0 : (changed / pixels) * 100;
}

export interface DetectorState {
  // Frames seen since the camera started.
  frames: number;
  // When the last crossing was, or null before the first.
  lastCrossingAt: number | null;
}

export const START: DetectorState = { frames: 0, lastCrossingAt: null };

// Whether the next frame falls in the frames skipped after the camera starts (so there's no need to compare it).
export function skipping(state: DetectorState, settings: DetectorSettings): boolean {
  return state.frames < settings.framesToSkip;
}

// Whether the next frame is needed at all: the first frame compared needs the one before it, so only the frames
// skipped before that can go unread (which saves the phone copying them).
export function frameNeeded(state: DetectorState, settings: DetectorSettings): boolean {
  return state.frames + 1 >= settings.framesToSkip;
}

// One frame: `change` is its changedPercent, or null when it wasn't compared (skipped, or nothing to compare with).
// A crossing is a change above the threshold, outside the cooldown after the last crossing.
export function nextFrame(
  state: DetectorState,
  change: number | null,
  at: number,
  settings: DetectorSettings,
): { state: DetectorState; crossing: boolean } {
  const frames = state.frames + 1;
  const crossing =
    change !== null &&
    frames > settings.framesToSkip &&
    change > settings.threshold &&
    (state.lastCrossingAt === null || at - state.lastCrossingAt > settings.cooldown);
  return { state: { frames, lastCrossingAt: crossing ? at : state.lastCrossingAt }, crossing };
}

// Where a frame's time came from, best first: when the camera captured it, when the screen is due to show it, when
// the browser handed it to the detector, or (when none of those can be believed) when the detector got to it.
export type FrameTimeSource = "camera" | "display" | "arrival" | "checked";

// What requestVideoFrameCallback says about a frame (the parts used here).
export interface FrameMetadata {
  captureTime?: number;
  expectedDisplayTime?: number;
}

// A frame time further from now than this isn't believed: a capture is in the past, a display just ahead.
const AHEAD_MS = 100;
const BEHIND_MS = 1000;

// When a frame happened, on now()'s clock (src/timing/clock.ts): the browser gives times relative to
// performance.timeOrigin, as performance.now() does. `arrival` is the time requestVideoFrameCallback passed with the
// frame, and `performanceNow` is performance.now() as the frame is checked.
export function frameTime(
  metadata: FrameMetadata | undefined,
  arrival: number | undefined,
  timeOrigin: number,
  performanceNow: number,
): { at: number; source: FrameTimeSource } {
  const candidates: [number | undefined, FrameTimeSource][] = [
    [metadata?.captureTime, "camera"],
    [metadata?.expectedDisplayTime, "display"],
    [arrival, "arrival"],
  ];
  for (const [time, source] of candidates) {
    if (
      time !== undefined &&
      Number.isFinite(time) &&
      time <= performanceNow + AHEAD_MS &&
      time >= performanceNow - BEHIND_MS
    ) {
      return { at: timeOrigin + time, source };
    }
  }
  return { at: timeOrigin + performanceNow, source: "checked" };
}
