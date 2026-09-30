"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useLatest } from "@/hooks/use-latest";
import { integrationEffect } from "@/integrations/run-effect";
import type { TimingIntegrations } from "@/integrations/types";
import { loadActiveRun, saveActiveRun } from "@/timing/active-run-store";
import { now } from "@/timing/clock";
import type { FinishedRun, RunningRun } from "@/timing/engine";
import { createTimingStore } from "@/timing/timing-store";

// The practice run: the timing store, a checkpoint after every event, the Pi integrations, gap tracking while the
// page is hidden, and recovery of a run that was interrupted by a reload.
export function useTimingSession({
  integrations,
  onFinished,
}: {
  integrations: TimingIntegrations;
  onFinished: (run: FinishedRun) => void;
}) {
  const [store] = useState(() => createTimingStore());
  const run = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const [interrupted, setInterrupted] = useState<RunningRun | null>(null);
  const onFinishedRef = useLatest(onFinished);

  useEffect(() => {
    const removers = [
      store.addEffect((next) => saveActiveRun(next)),
      store.addEffect(integrationEffect(integrations)),
      store.addEffect((next, previous) => {
        if (next.status === "finished" && previous.status === "running") onFinishedRef.current(next);
      }),
    ];
    return () => removers.forEach((remove) => remove());
  }, [store, integrations, onFinishedRef]);

  useEffect(() => {
    setInterrupted(loadActiveRun());
  }, []);

  // Laps can't be seen while the page is hidden (screen off, another app), so mark the gap.
  useEffect(() => {
    const onVisibilityChange = () => store.dispatch({ type: document.hidden ? "hidden" : "visible", at: now() });
    const onPageHide = () => store.dispatch({ type: "hidden", at: now() });
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [store]);

  // Carry on with the interrupted run; the time the page was gone becomes a gap.
  const resume = useCallback(() => {
    if (!interrupted) return;
    store.restore(interrupted);
    store.dispatch({ type: "resume", at: now() });
    setInterrupted(null);
  }, [interrupted, store]);

  // End the interrupted run where it stopped and save its laps.
  const finishInterrupted = useCallback(() => {
    if (!interrupted) return;
    store.restore(interrupted);
    store.dispatch({ type: "end", at: interrupted.lastEventAt });
    setInterrupted(null);
  }, [interrupted, store]);

  const discardInterrupted = useCallback(() => {
    saveActiveRun({ status: "idle" });
    setInterrupted(null);
  }, []);

  return { store, run, dispatch: store.dispatch, interrupted, resume, finishInterrupted, discardInterrupted };
}
