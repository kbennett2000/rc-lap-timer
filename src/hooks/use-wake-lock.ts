"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logger";

// Keeps the screen on while timing. request() must first be called from a tap (Safari requires it); the lock is
// taken again automatically when the page becomes visible, until release() is called.
export function useWakeLock() {
  const [supported] = useState(() => typeof navigator !== "undefined" && "wakeLock" in navigator);
  const [active, setActive] = useState(false);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const wantedRef = useRef(false);

  const acquire = useCallback(async () => {
    if (!supported || document.visibilityState !== "visible") return;
    if (sentinelRef.current && !sentinelRef.current.released) return;
    try {
      const sentinel = await navigator.wakeLock.request("screen");
      if (!wantedRef.current) {
        await sentinel.release();
        return;
      }
      sentinelRef.current = sentinel;
      setActive(true);
      sentinel.addEventListener("release", () => {
        if (sentinelRef.current === sentinel) {
          sentinelRef.current = null;
          setActive(false);
        }
      });
    } catch (error) {
      logger.warn("Could not keep the screen on:", error);
    }
  }, [supported]);

  const request = useCallback(() => {
    wantedRef.current = true;
    void acquire();
  }, [acquire]);

  const release = useCallback(() => {
    wantedRef.current = false;
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    setActive(false);
    sentinel?.release().catch(() => {});
  }, []);

  useEffect(() => {
    // The browser drops the lock when the page is hidden.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && wantedRef.current) void acquire();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      sentinelRef.current?.release().catch(() => {});
    };
  }, [acquire]);

  return { supported, active, request, release };
}
