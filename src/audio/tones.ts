// Beeps on one shared AudioContext. Browsers (iOS Safari above all) only let audio start after a user gesture, so
// unlockAudio() must be called from a tap before the first sound; after that, sounds can play from timers and
// detector callbacks too.

import { logger } from "@/lib/logger";

export interface Tone {
  frequency: number;
  duration: number; // ms
  volume?: number;
  type?: OscillatorType;
  gapAfter?: number; // ms of silence before the next tone
}

type WindowWithWebkitAudio = Window & { webkitAudioContext?: typeof AudioContext };

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!context) {
    // Safari before 14.1 only has the prefixed webkitAudioContext.
    const AudioContextClass = window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
    if (!AudioContextClass) return null;
    try {
      context = new AudioContextClass();
    } catch (error) {
      logger.warn("Audio is unavailable:", error);
      return null;
    }
  }
  return context;
}

// Call from a tap handler. Creates or resumes the shared context.
export function unlockTones(): void {
  const ctx = getContext();
  if (ctx && ctx.state !== "running") ctx.resume().catch(() => {});
}

// Plays the tones back to back. Resolves when the last one ends.
export function playTones(tones: Tone[]): Promise<void> {
  const ctx = getContext();
  if (!ctx || tones.length === 0) return Promise.resolve();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  const startAt = ctx.currentTime + 0.01;
  let at = startAt;
  for (const tone of tones) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = tone.type ?? "square";
    oscillator.frequency.value = tone.frequency;
    gain.gain.value = tone.volume ?? 0.5;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(at);
    oscillator.stop(at + tone.duration / 1000);
    at += (tone.duration + (tone.gapAfter ?? 0)) / 1000;
  }
  return new Promise((resolve) => setTimeout(resolve, (at - startAt) * 1000));
}

export const beep = (tone: Partial<Tone> = {}) => playTones([{ frequency: 440, duration: 200, ...tone }]);

export const SOUNDS = {
  start: [
    { frequency: 440, duration: 300, gapAfter: 20 },
    { frequency: 440, duration: 200 },
  ],
  lap: [{ frequency: 440, duration: 200 }],
  finish: [
    { frequency: 440, duration: 100, gapAfter: 20 },
    { frequency: 554, duration: 100, gapAfter: 20 },
    { frequency: 659, duration: 100, gapAfter: 20 },
    { frequency: 880, duration: 100, gapAfter: 20 },
    { frequency: 880, duration: 150, volume: 0.6, type: "triangle" },
    { frequency: 1320, duration: 400, volume: 0.7 },
  ],
  countdown: [{ frequency: 440, duration: 100 }],
  go: [{ frequency: 880, duration: 400, volume: 0.7, type: "sawtooth" }],
} satisfies Record<string, Tone[]>;

// iPhone only (Safari 17+): let sounds play when the ringer switch is on silent. This pauses other audio, such as
// music, so it's opt-in.
export function canPlayThroughSilentSwitch(): boolean {
  return typeof navigator !== "undefined" && "audioSession" in navigator;
}

export function setPlayThroughSilentSwitch(enabled: boolean): void {
  if (!canPlayThroughSilentSwitch()) return;
  (navigator as Navigator & { audioSession: { type: string } }).audioSession.type = enabled ? "playback" : "auto";
}
