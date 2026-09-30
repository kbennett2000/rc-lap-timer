import { unlockSpeech } from "./speech";
import { unlockTones } from "./tones";

export { say, stopSpeech } from "./speech";
export { beep, playTones, SOUNDS, canPlayThroughSilentSwitch, setPlayThroughSilentSwitch, type Tone } from "./tones";

// Call from every tap that may be followed by sound or speech (Start, Cam On, Resume...).
export function unlockAudio(): void {
  unlockTones();
  unlockSpeech();
}
