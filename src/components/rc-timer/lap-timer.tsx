"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Car as CarIcon, UserCog, Flag } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { Driver, Session, LapStats, PenaltyData } from "@/types/rc-timer";
import DriverCarManager from "@/components/driver-car-manager";

import { RacingSession } from "../racing-session";
import { RaceHistory } from "../racing-session/race-history";

import PracticeControl from "./practice-control";

export default function LapTimer() {
  const [activeTab, setActiveTab] = useState("practice");
  const [isMobile, setIsMobile] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [savedSessions, setSavedSessions] = useState<Session[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timer | null>(null);

  // Listen for window resize events
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsMobile(window.innerWidth <= 768);

      const handleResize = () => {
        setIsMobile(window.innerWidth <= 768);
      };

      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  // Load data function
  const loadSavedData = async () => {
    try {
      const response = await fetch("/api/data");
      if (!response.ok) throw new Error("Failed to load data");

      const data = await response.json();

      // Transform sessions to include stats
      const sessionsWithStats = data.sessions.map((session: any) => ({
        ...session,
        stats: calculateSessionStats(session),
      }));

      setSavedSessions(sessionsWithStats);
      setDrivers(data.drivers);
      setLocations(data.locations);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  // Load data on component mount
  useEffect(() => {
    loadSavedData();
  }, []);

  // Set up auto-refresh on mount
  useEffect(() => {
    // Initial load
    loadSavedData();

    // Set up polling interval (every 5 seconds)
    const interval = setInterval(refreshData, 5000);
    setRefreshInterval(interval);

    // Cleanup on unmount
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, []);

  const calculateSessionStats = (session: any) => {
    // Ensure laps is an array and each lap has a lapTime
    const lapTimes = session.laps.filter((lap: any) => lap && typeof lap.lapTime === "number").map((lap: any) => lap.lapTime);

    if (lapTimes.length === 0) {
      return {
        average: 0,
        totalTime: 0,
        bestLap: 0,
        worstLap: 0,
        maxPenaltyLap: null,
        maxPenaltyCount: 0,
        totalPenalties: 0,
      };
    }

    const totalTime = lapTimes.reduce((sum: number, time: number) => sum + time, 0);
    const bestLapTime = Math.min(...lapTimes);
    const worstLapTime = Math.max(...lapTimes);

    // Calculate total penalties and find lap with most penalties
    let maxPenaltyLap = null;
    let maxPenaltyCount = 0;
    let totalPenalties = 0;

    if (session.penalties && Array.isArray(session.penalties)) {
      session.penalties.forEach((penalty: any) => {
        if (penalty.count) {
          totalPenalties += penalty.count;
          if (penalty.count > maxPenaltyCount) {
            maxPenaltyCount = penalty.count;
            maxPenaltyLap = penalty.lapNumber;
          }
        }
      });
    }

    return {
      average: totalTime / lapTimes.length,
      totalTime,
      bestLap: bestLapTime,
      worstLap: worstLapTime,
      maxPenaltyLap,
      maxPenaltyCount,
      totalPenalties,
    };
  };

  // Auto-refresh function
  const refreshData = async () => {
    try {
      const response = await fetch("/api/data");
      if (!response.ok) throw new Error("Failed to load data");

      const data = await response.json();

      // Transform sessions to include stats
      const sessionsWithStats = data.sessions.map((session: any) => ({
        ...session,
        stats: calculateSessionStats(session),
      }));

      // Only update if data has changed
      if (JSON.stringify(sessionsWithStats) !== JSON.stringify(savedSessions)) {
        setSavedSessions(sessionsWithStats);
      }
      if (JSON.stringify(data.drivers) !== JSON.stringify(drivers)) {
        setDrivers(data.drivers);
      }

      if (JSON.stringify(data.locations) !== JSON.stringify(locations)) {
        setLocations(data.locations);
      }
    } catch (error) {
      logger.error("Error refreshing data:", error);
    }
  };

  // ****************************************
  // return
  // ****************************************
  return (
    <div className="min-h-screen bg-white">
      {/* Main Content Area */}
      <div className="pt-16 pb-20">
        <AnimatePresence mode="wait">
          <motion.div key={isMobile ? "mobile" : "desktop"} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.5 }} className={isMobile ? "mobile-layout" : "desktop-layout"}>
            <Tabs defaultValue="practice" className="h-full" value={activeTab} onValueChange={setActiveTab}>
              {/* Practice Tab */}
              <TabsContent value="practice" className="px-4 space-y-4 h-full overflow-y-auto">
                <motion.div key={activeTab} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.3 }}>
                  {/* Practice Tab */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Practice</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <PracticeControl />
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              {/* Race Session Tab */}
              <TabsContent value="race" className="px-4 space-y-4 h-full overflow-y-auto">
                <motion.div key={activeTab} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.3 }}>
                  {/* Session Configuration Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Race Session</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* NEW */}
                      <div className="space-y-3 p-4 bg-gray-50 rounded">
                        <RacingSession />
                        <RaceHistory />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              {/* Driver Car Manager Tab */}
              <TabsContent value="drivercarmanager" className="space-y-4">
                <motion.div key={activeTab} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.3 }}>
                  {/* Driver Car Manager */}
                  <DriverCarManager drivers={drivers} locations={locations} onDriversUpdate={setDrivers} onLocationsUpdate={setLocations} onSessionsUpdate={setSavedSessions} />
                </motion.div>
              </TabsContent>

              {/* Bottom Navigation */}
              <div className="fixed bottom-0 left-0 right-0 bg-white border-t z-50 shadow-up">
                <TabsList className="grid grid-cols-3 gap-0">
                  {/* Practice */}
                  <TabsTrigger value="practice" className="py-3">
                    <div className="flex flex-col items-center">
                      <CarIcon className="h-5 w-5" />
                      <span className="text-xs mt-1">Practice</span>
                    </div>
                  </TabsTrigger>

                  {/* Race */}
                  <TabsTrigger value="race" className="py-3">
                    <div className="flex flex-col items-center">
                      <Flag className="h-5 w-5" />
                      <span className="text-xs mt-1">Race</span>
                    </div>
                  </TabsTrigger>

                  {/* settings / Driver Car Manager */}
                  <TabsTrigger value="drivercarmanager" className="py-3">
                    <div className="flex flex-col items-center">
                      <UserCog className="h-5 w-5" />
                      <span className="text-xs mt-1">Manager</span>
                    </div>
                  </TabsTrigger>
                </TabsList>
              </div>
            </Tabs>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
