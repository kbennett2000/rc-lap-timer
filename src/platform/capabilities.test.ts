import { describe, expect, it } from "vitest";
import { capabilitiesFor } from "./capabilities";

describe("capabilitiesFor", () => {
  it("gives the Pi build its features, with the data on the Pi", () => {
    expect(capabilitiesFor("pi")).toEqual({
      races: true,
      irTiming: true,
      remoteControl: true,
      liveSessionView: true,
      ledDisplay: true,
      piSystemConfig: true,
      onDeviceData: false,
      cloud: false,
    });
  });

  it("hides every Pi feature in the phone-only build, which keeps its data on the phone", () => {
    expect(capabilitiesFor("standalone")).toEqual({
      races: false,
      irTiming: false,
      remoteControl: false,
      liveSessionView: false,
      ledDisplay: false,
      piSystemConfig: false,
      onDeviceData: true,
      cloud: false,
    });
  });

  it("has the cloud features only in a phone-only build given a Supabase project", () => {
    expect(capabilitiesFor("standalone", { cloudConfigured: true }).cloud).toBe(true);
    expect(capabilitiesFor("pi", { cloudConfigured: true }).cloud).toBe(false);
  });
});
