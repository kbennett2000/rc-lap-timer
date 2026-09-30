import { describe, expect, it } from "vitest";
import { changedPercent, DEFAULT_SETTINGS, nextFrame, skipping, START, type DetectorState } from "./motion";

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
