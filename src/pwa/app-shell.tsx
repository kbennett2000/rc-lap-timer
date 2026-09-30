"use client";

import { useEffect, useRef, useState } from "react";
import type { Workbox } from "workbox-window";
import { Button } from "@/components/ui/button";
import { ACTIVE_RUN_KEY } from "@/timing/active-run-store";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function runIsActive(): boolean {
  try {
    return localStorage.getItem(ACTIVE_RUN_KEY) !== null;
  } catch {
    return false;
  }
}

// The phone-only app's service worker (scripts/build-pages.mjs), which keeps a copy of the app for offline use.
// A new version waits until the user chooses to reload, and the offer only shows between runs. Installed apps are
// resumed rather than reopened, so it also checks for a new version whenever the app comes back to the front.
export default function AppShell() {
  const workbox = useRef<Workbox | null>(null);
  const reloadRequested = useRef(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;
    void import("workbox-window").then(({ Workbox }) => {
      if (cancelled) return;
      const wb = new Workbox(`${basePath}/sw.js`, { scope: `${basePath}/` });
      wb.addEventListener("waiting", () => setUpdateReady(true));
      // Only the tab where Reload was tapped reloads: another tab may be in the middle of a run.
      wb.addEventListener("controlling", () => {
        if (reloadRequested.current) window.location.reload();
      });
      workbox.current = wb;
      void wb.register();
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") void workbox.current?.update();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // While an update waits, watch for runs starting and ending (they're checkpointed in localStorage).
  useEffect(() => {
    if (!updateReady) return;
    const check = () => setRunning(runIsActive());
    check();
    const timer = setInterval(check, 2000);
    return () => clearInterval(timer);
  }, [updateReady]);

  if (!updateReady || running) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-2 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex items-center justify-between gap-3 rounded-lg border bg-white p-3 text-sm shadow-lg"
    >
      <span>A new version of the app is ready.</span>
      <Button
        size="sm"
        onClick={() => {
          reloadRequested.current = true;
          workbox.current?.messageSkipWaiting();
        }}
      >
        Reload
      </Button>
    </div>
  );
}
