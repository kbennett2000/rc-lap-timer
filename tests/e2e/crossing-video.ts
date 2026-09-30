// A video of a car crossing the picture, for camera timing tests (camera.spec.ts). Chromium plays it as its camera
// (--use-file-for-fake-video-capture, set in playwright.config.ts), looping. The picture is plain grey, and a dark block
// crosses it once per loop, so each lap should be exactly one loop long.

import { existsSync, mkdirSync, openSync, closeSync, writeSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";

export const CROSSING_VIDEO = {
  width: 640,
  height: 360,
  fps: 30,
  // One loop, and so one lap, in frames: 2 s.
  loopFrames: 60,
  // The block crosses in these frames (half a second).
  crossingFrames: [20, 35] as const,
};

export const LOOP_MS = (CROSSING_VIDEO.loopFrames * 1000) / CROSSING_VIDEO.fps;

const BACKGROUND = 160;
const CAR = 40;
const CAR_WIDTH = 96;
const CAR_HEIGHT = 72;

// Writes the video (YUV4MPEG2, the raw format Chromium reads) once, and returns its path.
export function crossingVideo(dir = join(process.cwd(), "node_modules", ".cache", "rc-lap-timer-e2e")): string {
  const { width, height, fps, loopFrames, crossingFrames } = CROSSING_VIDEO;
  const path = join(dir, `crossing-${width}x${height}-${fps}fps-${loopFrames}.y4m`);
  if (existsSync(path)) return path;

  mkdirSync(dirname(path), { recursive: true });
  const partial = `${path}.partial`;
  const file = openSync(partial, "w");
  const luma = Buffer.alloc(width * height);
  const chroma = Buffer.alloc((width / 2) * (height / 2) * 2, 128); // grey: no colour
  const [first, last] = crossingFrames;
  const top = Math.round((height - CAR_HEIGHT) / 2);
  writeSync(file, `YUV4MPEG2 W${width} H${height} F${fps}:1 Ip A1:1 C420jpeg\n`);
  for (let frame = 0; frame < loopFrames; frame++) {
    luma.fill(BACKGROUND);
    if (frame >= first && frame < last) {
      // From just off the left edge to just off the right, in equal steps.
      const left = Math.round(-CAR_WIDTH + ((frame - first + 1) * (width + CAR_WIDTH)) / (last - first + 1));
      for (let row = top; row < top + CAR_HEIGHT; row++) {
        const from = Math.max(0, left);
        const to = Math.min(width, left + CAR_WIDTH);
        if (to > from) luma.fill(CAR, row * width + from, row * width + to);
      }
    }
    writeSync(file, "FRAME\n");
    writeSync(file, luma);
    writeSync(file, chroma);
  }
  closeSync(file);
  renameSync(partial, path);
  return path;
}
