import { describe, expect, it } from "vitest";
import {
  analysisSize,
  changedPercent,
  DEFAULT_SETTINGS,
  frameTime,
  nextFrame,
  skipping,
  START,
  type DetectorState,
} from "./motion";

// An RGBA frame of one grey level, with optional rectangles drawn on it.
function frame(width: number, height: number, grey = 128) {
  const data = new Uint8ClampedArray(width * height * 4).fill(grey);
  const fill = (x: number, y: number, w: number, h: number, rgb: [number, number, number]) => {
    for (let row = y; row < y + h; row++) {
      for (let col = x; col < x + w; col++) data.set(rgb, (row * width + col) * 4);
    }
    return api;
  };
  const api = { data, fill };
  return api;
}

describe("analysisSize", () => {
  it("shrinks the longest side to 320 pixels, keeping the shape", () => {
    expect(analysisSize(1280, 720)).toEqual({ width: 320, height: 180 });
    expect(analysisSize(720, 1280)).toEqual({ width: 180, height: 320 });
    expect(analysisSize(1920, 1080)).toEqual({ width: 320, height: 180 });
    expect(analysisSize(640, 480)).toEqual({ width: 320, height: 240 });
  });

  it("never enlarges a small frame", () => {
    expect(analysisSize(320, 180)).toEqual({ width: 320, height: 180 });
    expect(analysisSize(160, 120)).toEqual({ width: 160, height: 120 });
  });

  it("always gives at least one pixel", () => {
    expect(analysisSize(4000, 1)).toEqual({ width: 320, height: 1 });
    expect(analysisSize(0, 0)).toEqual({ width: 1, height: 1 });
  });
});

describe("changedPercent", () => {
  it("is 0 for the same picture", () => {
    expect(changedPercent(frame(8, 8).data, frame(8, 8).data, 10)).toBe(0);
  });

  it("is the share of the picture that changed", () => {
    const empty = frame(10, 10);
    const car = frame(10, 10).fill(2, 3, 5, 2, [20, 20, 20]); // 10 of 100 pixels
    expect(changedPercent(empty.data, car.data, 50)).toBe(10);
    expect(changedPercent(car.data, empty.data, 50)).toBe(10);
  });

  it("ignores changes up to the sensitivity, like camera noise", () => {
    const empty = frame(10, 10);
    const noisy = frame(10, 10, 128 + 30);
    expect(changedPercent(empty.data, noisy.data, 30)).toBe(0);
    expect(changedPercent(empty.data, noisy.data, 29)).toBe(100);
  });

  it("counts a pixel when any one of red, green or blue changes enough", () => {
    const empty = frame(2, 2);
    expect(changedPercent(empty.data, frame(2, 2).fill(0, 0, 1, 1, [128, 128, 200]).data, 50)).toBe(25);
    expect(changedPercent(empty.data, frame(2, 2).fill(0, 0, 1, 1, [128, 200, 128]).data, 50)).toBe(25);
    expect(changedPercent(empty.data, frame(2, 2).fill(0, 0, 1, 1, [200, 128, 128]).data, 50)).toBe(25);
  });

  it("ignores the alpha channel", () => {
    const empty = frame(2, 2);
    const alpha = frame(2, 2);
    alpha.data[3] = 0;
    expect(changedPercent(empty.data, alpha.data, 10)).toBe(0);
  });
});

describe("nextFrame", () => {
  const settings = { ...DEFAULT_SETTINGS, threshold: 5, cooldown: 1000, framesToSkip: 2 };

  // Feeds frames of the given changes, one every 100 ms from t=0, and returns the times of the crossings.
  function crossings(changes: (number | null)[], from: DetectorState = START) {
    let state = from;
    const at: number[] = [];
    changes.forEach((change, i) => {
      const result = nextFrame(state, change, i * 100, settings);
      state = result.state;
      if (result.crossing) at.push(i * 100);
    });
    return { at, state };
  }

  it("skips the first frames after the camera starts", () => {
    expect(skipping(START, settings)).toBe(true);
    expect(skipping({ ...START, frames: 1 }, settings)).toBe(true);
    expect(skipping({ ...START, frames: 2 }, settings)).toBe(false);
    expect(crossings([50, 50, 50]).at).toEqual([200]);
  });

  it("counts the first crossing whenever it comes", () => {
    expect(crossings([null, null, 50]).at).toEqual([200]);
  });

  it("needs more change than the threshold", () => {
    expect(crossings([null, null, 5, 5.1]).at).toEqual([300]);
  });

  it("doesn't count frames that weren't compared", () => {
    expect(crossings([null, null, null, null]).at).toEqual([]);
  });

  it("ignores crossings within the cooldown of the last one", () => {
    // Crossing at 200; 1200 is exactly the cooldown later, so the next is 1300.
    const changes = Array.from({ length: 16 }, (_, i) => (i >= 2 ? 50 : null));
    expect(crossings(changes).at).toEqual([200, 1300]);
  });

  it("counts frames and remembers the last crossing", () => {
    expect(crossings([null, null, 50, 0]).state).toEqual({ frames: 4, lastCrossingAt: 200 });
  });
});

describe("frameTime", () => {
  const ORIGIN = 1_700_000_000_000;
  const NOW = 50_000; // performance.now() as the frame is checked

  it("uses when the camera captured the frame", () => {
    expect(frameTime({ captureTime: NOW - 40, expectedDisplayTime: NOW + 16 }, NOW - 5, ORIGIN, NOW)).toEqual({
      at: ORIGIN + NOW - 40,
      source: "camera",
    });
  });

  it("falls back to when the screen shows it, then to when it arrived, then to now", () => {
    expect(frameTime({ expectedDisplayTime: NOW + 16 }, NOW - 5, ORIGIN, NOW)).toEqual({
      at: ORIGIN + NOW + 16,
      source: "display",
    });
    expect(frameTime({}, NOW - 5, ORIGIN, NOW)).toEqual({ at: ORIGIN + NOW - 5, source: "arrival" });
    expect(frameTime(undefined, undefined, ORIGIN, NOW)).toEqual({ at: ORIGIN + NOW, source: "checked" });
  });

  it("doesn't believe a time too far in the future or the past", () => {
    expect(frameTime({ captureTime: NOW + 101 }, undefined, ORIGIN, NOW).source).toBe("checked");
    expect(frameTime({ captureTime: NOW - 1001 }, undefined, ORIGIN, NOW).source).toBe("checked");
    expect(frameTime({ captureTime: 0 }, NOW - 5, ORIGIN, NOW).source).toBe("arrival");
    expect(frameTime({ captureTime: Number.NaN }, NOW - 5, ORIGIN, NOW).source).toBe("arrival");
    expect(frameTime({ captureTime: NOW + 100 }, undefined, ORIGIN, NOW).source).toBe("camera");
    expect(frameTime({ captureTime: NOW - 1000 }, undefined, ORIGIN, NOW).source).toBe("camera");
  });
});
