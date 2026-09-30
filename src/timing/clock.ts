// Milliseconds since the epoch with sub-millisecond resolution. Monotonic within a page (unlike Date.now(), it
// doesn't jump when the device clock is adjusted) and close enough to wall-clock time to compare across reloads.
export function now(): number {
  return performance.timeOrigin + performance.now();
}
