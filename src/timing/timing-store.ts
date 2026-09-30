import { IDLE, reduce, type Run, type TimingEvent } from "./engine";

// Called after every event that changed the run, with the new and previous run.
export type RunEffect = (run: Run, previous: Run, event: TimingEvent) => void;

export interface TimingStore {
  getState(): Run;
  dispatch(event: TimingEvent): Run;
  // Replace the run without running effects (restoring a checkpoint).
  restore(run: Run): void;
  subscribe(listener: () => void): () => void;
  addEffect(effect: RunEffect): () => void;
}

// A tiny external store, read with useSyncExternalStore. Camera and IR callbacks dispatch into it directly, so they
// always see the current run rather than a stale React closure.
export function createTimingStore(initial: Run = IDLE): TimingStore {
  let state = initial;
  const listeners = new Set<() => void>();
  const effects = new Set<RunEffect>();

  return {
    getState: () => state,
    dispatch(event) {
      const previous = state;
      const next = reduce(previous, event);
      if (next === previous) return previous;
      state = next;
      effects.forEach((effect) => effect(next, previous, event));
      listeners.forEach((listener) => listener());
      return next;
    },
    restore(run) {
      state = run;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    addEffect(effect) {
      effects.add(effect);
      return () => effects.delete(effect);
    },
  };
}
