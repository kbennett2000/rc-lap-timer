// Spoken announcements. One utterance at a time; a new announcement waits for the current one instead of cutting
// it off, and only the newest waiting announcement is kept, so a fast run of laps never builds a backlog.

type Synth = Pick<SpeechSynthesis, "speak" | "getVoices" | "cancel"> &
  Partial<Pick<SpeechSynthesis, "addEventListener">>;
type UtteranceClass = new (text: string) => SpeechSynthesisUtterance;

export function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  return (
    voices.find((voice) => voice.name === "Google US English") ??
    voices.find((voice) => voice.lang === "en-US") ??
    voices.find((voice) => voice.lang.startsWith("en")) ??
    null
  );
}

export function createSpeaker(synth: Synth, Utterance: UtteranceClass) {
  let voice: SpeechSynthesisVoice | null = null;
  let speaking = false;
  let waiting: string | null = null;
  let unlocked = false;

  const updateVoice = () => {
    voice = pickVoice(synth.getVoices()) ?? voice;
  };
  updateVoice();
  synth.addEventListener?.("voiceschanged", updateVoice);

  function speakNow(text: string) {
    speaking = true;
    const utterance = new Utterance(text);
    utterance.rate = 1.2;
    utterance.lang = "en-US";
    if (voice) utterance.voice = voice;
    let done = false;
    const next = () => {
      if (done) return;
      done = true;
      clearTimeout(watchdog);
      speaking = false;
      const nextText = waiting;
      waiting = null;
      if (nextText !== null) speakNow(nextText);
    };
    // Some engines never fire `end` (or drop the utterance); don't let that block later announcements.
    const watchdog = setTimeout(next, 4000 + text.length * 150);
    utterance.onend = next;
    utterance.onerror = next;
    synth.speak(utterance);
  }

  return {
    say(text: string) {
      if (!text.trim()) return;
      if (speaking) waiting = text;
      else speakNow(text);
    },
    // iOS only speaks after a first speak() inside a user gesture.
    unlock() {
      if (unlocked) return;
      unlocked = true;
      synth.speak(new Utterance(""));
    },
    stop() {
      waiting = null;
      synth.cancel();
    },
  };
}

type Speaker = ReturnType<typeof createSpeaker>;
let speaker: Speaker | null | undefined;

function getSpeaker(): Speaker | null {
  if (speaker === undefined) {
    speaker =
      typeof window !== "undefined" && window.speechSynthesis && typeof SpeechSynthesisUtterance !== "undefined"
        ? createSpeaker(window.speechSynthesis, SpeechSynthesisUtterance)
        : null;
  }
  return speaker;
}

export const say = (text: string) => getSpeaker()?.say(text);
export const unlockSpeech = () => getSpeaker()?.unlock();
export const stopSpeech = () => getSpeaker()?.stop();
