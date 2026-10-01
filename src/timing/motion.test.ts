import { describe, expect, it } from "vitest";
import {
  analysisSize,
  boxFromCorners,
  boxPixels,
  calibrate,
  changedPercent,
  DEFAULT_SETTINGS,
  diffHistogram,
  frameNeeded,
  frameTime,
  nextFrame,
  parseBox,
  parseSettings,
  skipping,
  START,
  toFramePoint,
  type Box,
  type DetectorState,
} from "./motion";

const mapValues = <T extends object>(object: T, map: (n: number) => number) =>
  Object.fromEntries(Object.entries(object).map(([key, value]) => [key, map(value as number)])) as T;

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

  it("needs a frame only from the last skipped one on, which the first compared frame is compared with", () => {
    // framesToSkip 2: frame 1 isn't needed, frame 2 (skipped) is the first compared frame's previous one.
    expect(frameNeeded(START, settings)).toBe(false);
    expect(frameNeeded({ ...START, frames: 1 }, settings)).toBe(true);
    expect(frameNeeded({ ...START, frames: 5 }, settings)).toBe(true);
    expect(frameNeeded(START, { ...settings, framesToSkip: 1 })).toBe(true);
  });
});

describe("the start/finish box", () => {
  it("reads back a stored box, and nothing else", () => {
    const box = { x: 0.1, y: 0.4, width: 0.8, height: 0.2 };
    expect(parseBox(JSON.parse(JSON.stringify(box)))).toEqual(box);
    for (const value of [
      null,
      "box",
      { x: 0.1, y: 0.4, width: 0.8 },
      { x: -0.1, y: 0.4, width: 0.8, height: 0.2 },
      { x: 0.5, y: 0.4, width: 0.8, height: 0.2 },
      { x: 0.1, y: 0.4, width: 0.01, height: 0.2 },
      { x: 0.1, y: 0.4, width: Number.NaN, height: 0.2 },
    ]) {
      expect(parseBox(value)).toBeNull();
    }
  });

  it("is drawn between two corners, either way round, and kept inside the picture", () => {
    const rounded = (box: Box | null) => box && mapValues(box, (n) => Math.round(n * 1000) / 1000);
    expect(rounded(boxFromCorners({ x: 0.9, y: 0.6 }, { x: 0.1, y: 0.4 }))).toEqual({
      x: 0.1,
      y: 0.4,
      width: 0.8,
      height: 0.2,
    });
    expect(boxFromCorners({ x: -0.5, y: 0.5 }, { x: 0.5, y: 1.5 })).toEqual({ x: 0, y: 0.5, width: 0.5, height: 0.5 });
  });

  it("isn't made by a tap or a thin line", () => {
    expect(boxFromCorners({ x: 0.5, y: 0.5 }, { x: 0.51, y: 0.9 })).toBeNull();
    expect(boxFromCorners({ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.52 })).toBeNull();
  });

  it("is a whole number of the frame's pixels, inside the frame", () => {
    expect(boxPixels({ x: 0.1, y: 0.4, width: 0.8, height: 0.2 }, 640, 360)).toEqual({
      x: 64,
      y: 144,
      width: 512,
      height: 72,
    });
    expect(boxPixels(null, 640, 360)).toEqual({ x: 0, y: 0, width: 640, height: 360 });
    expect(boxPixels({ x: 0.999, y: 0.999, width: 0.001, height: 0.001 }, 100, 100)).toEqual({
      x: 99,
      y: 99,
      width: 1,
      height: 1,
    });
  });
});

describe("toFramePoint", () => {
  // A 200 × 100 preview at (10, 20) on the screen.
  const flat = { left: 10, top: 20, width: 200, height: 100 };
  // The same preview turned a quarter: it covers 100 × 200 around the same centre (110, 70).
  const turned = { left: 60, top: -30, width: 100, height: 200 };

  it("is the point's place in the preview when it isn't rotated", () => {
    expect(toFramePoint(10, 20, flat, 0)).toEqual({ x: 0, y: 0 });
    expect(toFramePoint(160, 45, flat, 0)).toEqual({ x: 0.75, y: 0.25 });
    expect(toFramePoint(500, -100, flat, 0)).toEqual({ x: 1, y: 0 });
  });

  it("undoes the preview's rotation", () => {
    // The picture's top-left corner, wherever rotating put it on the screen.
    expect(toFramePoint(160, -30, turned, 90)).toEqual({ x: 0, y: 0 });
    expect(toFramePoint(210, 120, flat, 180)).toEqual({ x: 0, y: 0 });
    expect(toFramePoint(60, 170, turned, 270)).toEqual({ x: 0, y: 0 });
    // A point a quarter of the way along the picture's top edge.
    expect(toFramePoint(160, 20, turned, 90)).toMatchObject({ x: 0.25, y: 0 });
    expect(toFramePoint(60, 120, turned, 270)).toMatchObject({ x: 0.25, y: 0 });
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

describe("parseSettings", () => {
  it("reads back settings that were saved", () => {
    const saved = { sensitivity: 40, threshold: 2.5, cooldown: 3000, framesToSkip: 15 };
    expect(parseSettings(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
  });

  it("uses the default for anything missing, out of range or not a number", () => {
    expect(parseSettings({ sensitivity: 4, threshold: 11, cooldown: "3000", framesToSkip: Number.NaN })).toEqual(
      DEFAULT_SETTINGS,
    );
    expect(parseSettings({ cooldown: 500 })).toEqual({ ...DEFAULT_SETTINGS, cooldown: 500 });
  });

  it("uses the defaults for something that isn't settings at all", () => {
    for (const value of [null, undefined, 42, "settings", [1, 2]])
      expect(parseSettings(value)).toEqual(DEFAULT_SETTINGS);
  });
});

describe("calibrate", () => {
  // A 40 × 30 frame of grey with grain: each pixel off by up to `grain` levels, the same way every time for a seed.
  function grainy(seed: number, grain: number) {
    const picture = frame(40, 30);
    let state = seed;
    for (let i = 0; i < picture.data.length; i += 4) {
      state = (state * 1103515245 + 12345) % 2147483648;
      const offset = grain === 0 ? 0 : (state % (2 * grain + 1)) - grain;
      picture.data[i] = picture.data[i + 1] = picture.data[i + 2] = 128 + offset;
    }
    return picture;
  }
  // The histograms of `count` pairs of frames, with a car (a dark 12 × 10 block) in the pairs `withCar` picks.
  function pairs(count: number, grain: number, withCar: (pair: number) => boolean = () => false) {
    return Array.from({ length: count }, (_, pair) => {
      const after = grainy(pair + 1, grain);
      if (withCar(pair)) after.fill(10 + pair, 10, 12, 10, [20, 20, 20]);
      return diffHistogram(grainy(pair, grain).data, after.data);
    });
  }

  it("counts each pixel by the most any colour changed", () => {
    const before = frame(2, 1);
    const after = frame(2, 1).fill(0, 0, 1, 1, [128, 140, 120]);
    const histogram = diffHistogram(before.data, after.data);
    expect(histogram[12]).toBe(1);
    expect(histogram[0]).toBe(1);
  });

  it("sets the most sensitive settings for a still, clean picture", () => {
    expect(calibrate(pairs(60, 0))).toEqual({ ok: true, sensitivity: 10, threshold: 0.3 });
  });

  it("sets sensitivity above the camera's grain, so grain alone never counts", () => {
    const result = calibrate(pairs(60, 12));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sensitivity).toBeGreaterThan(24); // two frames' grain can differ by up to 24
    for (let pair = 0; pair < 20; pair++) {
      const grain = changedPercent(grainy(pair, 12).data, grainy(pair + 1, 12).data, result.sensitivity);
      expect(grain).toBeLessThan(result.threshold);
    }
  });

  it("isn't thrown by a car passing during it", () => {
    // A car in a quarter of the pairs, as when one passes the line once in two seconds.
    expect(calibrate(pairs(60, 6, (pair) => pair % 4 === 0))).toEqual(calibrate(pairs(60, 6)));
  });

  it("gives up when the picture keeps changing, or there are too few frames", () => {
    expect(
      calibrate(pairs(60, 0, () => true).map(() => diffHistogram(frame(4, 4, 0).data, frame(4, 4, 255).data))),
    ).toEqual({ ok: false, reason: "moving" });
    expect(calibrate(pairs(4, 0))).toEqual({ ok: false, reason: "too-few" });
  });

  it("finds a car the settings it gives can see", () => {
    const result = calibrate(pairs(60, 8));
    if (!result.ok) throw new Error("not calibrated");
    const empty = grainy(100, 8);
    const car = grainy(101, 8).fill(10, 10, 12, 10, [20, 20, 20]); // 10% of the picture
    const change = changedPercent(empty.data, car.data, result.sensitivity);
    const { crossing } = nextFrame({ frames: 10, lastCrossingAt: null }, change, 0, {
      ...DEFAULT_SETTINGS,
      ...result,
      framesToSkip: 1,
    });
    expect(crossing).toBe(true);
  });
});
