import { say, SOUNDS, playTones, type Tone } from "@/audio";
import { formatLapTimeForSpeech } from "@/domain/format";
import { lapTimes, type Run, type TimingEvent } from "@/timing/engine";

export interface SoundSettings {
  beeps: boolean;
  announceLapNumber: boolean;
  announceLastLapTime: boolean;
}

export interface RunSounds {
  tones: Tone[] | null;
  speech: string | null;
}

// What to play and say for a change in the run: a start sound, a beep per lap, and the finish fanfare, with optional
// spoken lap numbers and lap times.
export function planRunSounds(run: Run, previous: Run, event: TimingEvent, settings: SoundSettings): RunSounds {
  const none: RunSounds = { tones: null, speech: null };
  if (event.type === "start" && run.status === "running") {
    return {
      tones: settings.beeps ? SOUNDS.start : null,
      speech: settings.announceLapNumber ? "Timing Session Started" : null,
    };
  }
  if (run.status === "idle" || previous.status !== "running") return none;

  const lapAdded = run.crossings.length > previous.crossings.length;
  const times = lapTimes(run);
  const lastLap =
    lapAdded && settings.announceLastLapTime ? `Last lap time ${formatLapTimeForSpeech(times[times.length - 1])}` : "";

  if (run.status === "finished") {
    const speech = [settings.announceLapNumber ? "Timing Session Ended." : "", lastLap].filter(Boolean).join(" ");
    return { tones: settings.beeps ? SOUNDS.finish : null, speech: speech || null };
  }
  if (lapAdded) {
    const speech = [settings.announceLapNumber ? `Lap ${run.crossings.length + 1} started.` : "", lastLap]
      .filter(Boolean)
      .join(" ");
    return { tones: settings.beeps ? SOUNDS.lap : null, speech: speech || null };
  }
  return none;
}

export function playRunSounds({ tones, speech }: RunSounds): void {
  if (tones) void playTones(tones);
  if (speech) say(speech);
}
