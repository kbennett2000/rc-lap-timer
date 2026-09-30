import { describe, expect, it, vi } from "vitest";
import { createSpeaker, pickVoice } from "./speech";

class FakeUtterance {
  rate = 1;
  lang = "";
  voice: SpeechSynthesisVoice | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

function fakeSynth(voices: Partial<SpeechSynthesisVoice>[] = []) {
  const spoken: FakeUtterance[] = [];
  return {
    spoken,
    speak: vi.fn((u: FakeUtterance) => void spoken.push(u)),
    getVoices: () => voices as SpeechSynthesisVoice[],
    cancel: vi.fn(),
  };
}

const makeSpeaker = (synth: ReturnType<typeof fakeSynth>) =>
  createSpeaker(synth as never, FakeUtterance as unknown as new (text: string) => SpeechSynthesisUtterance);

describe("pickVoice", () => {
  it("prefers Google US English, then en-US, then any English voice", () => {
    const v = (name: string, lang: string) => ({ name, lang }) as SpeechSynthesisVoice;
    expect(pickVoice([v("Other", "en-GB"), v("Google US English", "en-US")])?.name).toBe("Google US English");
    expect(pickVoice([v("Other", "en-GB"), v("Samantha", "en-US")])?.name).toBe("Samantha");
    expect(pickVoice([v("Daniel", "en-GB"), v("Thomas", "fr-FR")])?.name).toBe("Daniel");
    expect(pickVoice([v("Thomas", "fr-FR")])).toBeNull();
  });
});

describe("createSpeaker", () => {
  it("speaks right away when idle, without cancelling", () => {
    const synth = fakeSynth([{ name: "Samantha", lang: "en-US" }]);
    makeSpeaker(synth).say("Lap 2 started");
    expect(synth.spoken.map((u) => u.text)).toEqual(["Lap 2 started"]);
    expect(synth.spoken[0].voice?.name).toBe("Samantha");
    expect(synth.cancel).not.toHaveBeenCalled();
  });

  it("waits for the current announcement and keeps only the newest waiting one", () => {
    const synth = fakeSynth();
    const speaker = makeSpeaker(synth);
    speaker.say("one");
    speaker.say("two");
    speaker.say("three");
    expect(synth.spoken.map((u) => u.text)).toEqual(["one"]);
    synth.spoken[0].onend?.();
    expect(synth.spoken.map((u) => u.text)).toEqual(["one", "three"]);
  });

  it("moves on if the engine never reports the end", () => {
    vi.useFakeTimers();
    const synth = fakeSynth();
    const speaker = makeSpeaker(synth);
    speaker.say("stuck");
    speaker.say("next");
    vi.advanceTimersByTime(10_000);
    expect(synth.spoken.map((u) => u.text)).toEqual(["stuck", "next"]);
    vi.useRealTimers();
  });

  it("ignores blank text and unlocks only once", () => {
    const synth = fakeSynth();
    const speaker = makeSpeaker(synth);
    speaker.say("   ");
    speaker.unlock();
    speaker.unlock();
    expect(synth.spoken.map((u) => u.text)).toEqual([""]);
  });
});
