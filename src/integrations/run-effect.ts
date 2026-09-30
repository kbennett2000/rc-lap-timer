import { lapTimes, type Run, type TimingEvent } from "@/timing/engine";
import type { RunEffect } from "@/timing/timing-store";
import type { TimingIntegrations } from "./types";

// Turns timing-store changes into integration calls.
export function integrationEffect(integrations: TimingIntegrations): RunEffect {
  return (run: Run, previous: Run, event: TimingEvent) => {
    if (run.status === "running" && event.type === "start") {
      integrations.onStart(run);
      return;
    }
    if (run.status === "idle" || previous.status !== "running") return;

    if (run.crossings.length > previous.crossings.length) {
      const times = lapTimes(run);
      integrations.onLap(run, times.length, times[times.length - 1]);
    }
    if (run.status === "running" && event.type === "penalty") {
      integrations.onPenalty(run, run.crossings.length + 1);
    }
    if (run.status === "finished") integrations.onFinish(run);
  };
}
