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

// Frames are compared at this size (the longest side, in pixels): small enough for a phone to compare every frame, and
// still hundreds of pixels for a car crossing the picture. A smaller picture also averages away the camera's grain.
export const ANALYSIS_SIZE = 320;

// The size to compare a width × height camera frame at, keeping its shape and never enlarging it.
export function analysisSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, ANALYSIS_SIZE / Math.max(width, height, 1));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
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
