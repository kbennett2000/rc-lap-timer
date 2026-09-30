"use client";

import { useCallback, useEffect, useState } from "react";
import { sessionStats } from "@/domain/stats";
import type { Driver, Location, Session } from "@/domain/types";
import { logger } from "@/lib/logger";

// Drivers, locations and saved sessions from the Pi. Loaded when the Practice tab is shown and when the app comes
// back to the foreground, so changes made on other devices show up.
export function usePracticeData(isActive: boolean) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);

  const reload = useCallback(async () => {
    try {
      const response = await fetch("/api/data");
      if (!response.ok) throw new Error("Failed to load data");
      const data = await response.json();
      setSessions(data.sessions.map((session: Session) => ({ ...session, stats: sessionStats(session) })));
      setDrivers(data.drivers);
      setLocations(data.locations);
    } catch (error) {
      logger.error("Error loading data:", error);
    }
  }, []);

  useEffect(() => {
    if (isActive) reload();
  }, [isActive, reload]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") reload();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [reload]);

  return { drivers, setDrivers, locations, setLocations, sessions, setSessions, reload };
}
