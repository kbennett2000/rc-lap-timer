import type { FinishedRun, RunningRun } from "@/timing/engine";

// Side effects of a practice run outside this device: LEDs and the live view on the Pi. Calls are fire-and-forget;
// an integration must never throw or slow down timing.
export interface TimingIntegrations {
  onStart(run: RunningRun): void;
  onLap(run: RunningRun | FinishedRun, lapNumber: number, lapTime: number): void;
  onPenalty(run: RunningRun, lapNumber: number): void;
  onFinish(run: FinishedRun): void;
}
