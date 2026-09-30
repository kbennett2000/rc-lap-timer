"use client";

import { useEffect } from "react";
import { say } from "@/audio";
import { useLatest } from "@/hooks/use-latest";
import { logger } from "@/lib/logger";

export interface SessionRequest {
  id: string;
  driverId: string;
  carId: string;
  locationId: string;
  numberOfLaps: number;
}

const POLL_MS = 5000;

async function setRequestStatus(id: string, status: "IN_PROGRESS" | "COMPLETED" | "FAILED") {
  await fetch(`/api/session-requests/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

// Remote control: while enabled and no session is running, take the next session request made from another device
// (Session Mgmt > Request a Session) and set this device up for it. One request at a time.
export function useRemoteControl({
  enabled,
  isIdle,
  onRequest,
}: {
  enabled: boolean;
  isIdle: () => boolean;
  onRequest: (request: SessionRequest) => Promise<void>;
}) {
  const latest = useLatest({ isIdle, onRequest });

  useEffect(() => {
    if (!enabled) return;
    let inFlight = false;
    let stopped = false;

    const poll = async () => {
      if (inFlight || stopped || !latest.current.isIdle()) return;
      inFlight = true;
      try {
        const response = await fetch("/api/session-requests/next", { cache: "no-store" });
        if (!response.ok) throw new Error(`Failed to fetch requests: ${response.status}`);
        const { request } = (await response.json()) as { request: SessionRequest | null };
        if (!request || stopped) return;

        await setRequestStatus(request.id, "IN_PROGRESS");
        try {
          await latest.current.onRequest(request);
          await setRequestStatus(request.id, "COMPLETED");
          say("Session request received");
        } catch (error) {
          logger.error("Could not start the requested session:", error);
          await setRequestStatus(request.id, "FAILED");
        }
      } catch (error) {
        logger.error("Error polling for requests:", error);
      } finally {
        inFlight = false;
      }
    };

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [enabled, latest]);
}
