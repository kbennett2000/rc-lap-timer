import { describe, expect, it } from "vitest";
import { capabilitiesFor } from "./capabilities";

describe("capabilitiesFor", () => {
  it("gives the Pi build everything", () => {
    expect(Object.values(capabilitiesFor("pi")).every(Boolean)).toBe(true);
  });

  it("hides every Pi feature in the phone-only build", () => {
    expect(capabilitiesFor("standalone")).toEqual({
      races: false,
      irTiming: false,
      remoteControl: false,
      liveSessionView: false,
      ledDisplay: false,
      piSystemConfig: false,
    });
  });
});
