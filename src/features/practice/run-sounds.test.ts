import { describe, expect, it } from "vitest";
import { SOUNDS } from "@/audio";
import { IDLE, reduce, type Run, type RunConfig, type TimingEvent } from "@/timing/engine";
import { planRunSounds, type SoundSettings } from "./run-sounds";

const config: RunConfig = {
  driverId: "d",
  driverName: "D",
  carId: "c",
  carName: "C",
  locationId: "l",
  locationName: "L",
  lapTarget: 2,
  timingMode: "manual",
};
const all: SoundSettings = { beeps: true, announceLapNumber: true, announceLastLapTime: true };
const quiet: SoundSettings = { beeps: false, announceLapNumber: false, announceLastLapTime: false };

function step(run: Run, event: TimingEvent, settings: SoundSettings) {
  const next = reduce(run, event);
  return { next, sounds: planRunSounds(next, run, event, settings) };
}

describe("planRunSounds", () => {
  const start: TimingEvent = { type: "start", at: 0, id: "r", config };

  it("plays the start sound and announces the start", () => {
    expect(step(IDLE, start, all).sounds).toEqual({ tones: SOUNDS.start, speech: "Timing Session Started" });
    expect(step(IDLE, start, quiet).sounds).toEqual({ tones: null, speech: null });
  });

  it("beeps each lap and announces the next lap and the last lap time", () => {
    const running = reduce(IDLE, start);
    expect(step(running, { type: "lap", at: 12_340 }, all).sounds).toEqual({
      tones: SOUNDS.lap,
      speech: "Lap 2 started. Last lap time 12 point 34",
    });
  });

  it("plays the finish sound when the lap target is reached", () => {
    const oneLap = reduce(reduce(IDLE, start), { type: "lap", at: 10_000 });
    expect(step(oneLap, { type: "lap", at: 21_000 }, all).sounds).toEqual({
      tones: SOUNDS.finish,
      speech: "Timing Session Ended. Last lap time 11 point 00",
    });
  });

  it("ends without a lap time when the lap in progress is dropped", () => {
    const running = reduce(IDLE, start);
    expect(step(running, { type: "end", at: 5000 }, all).sounds).toEqual({
      tones: SOUNDS.finish,
      speech: "Timing Session Ended.",
    });
  });

  it("stays quiet for penalties and ignored events", () => {
    const running = reduce(IDLE, start);
    expect(step(running, { type: "penalty", at: 1 }, all).sounds).toEqual({ tones: null, speech: null });
    expect(step(IDLE, { type: "lap", at: 1 }, all).sounds).toEqual({ tones: null, speech: null });
  });
});
