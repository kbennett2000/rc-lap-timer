import type { TimingIntegrations } from "./types";

// For the phone-only build, which has no Pi to talk to.
export const noopIntegrations: TimingIntegrations = {
  onStart() {},
  onLap() {},
  onPenalty() {},
  onFinish() {},
};
