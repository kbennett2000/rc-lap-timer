import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTime, formatDateTime } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { Loader2, Clock, AlertTriangle, Trophy, Timer } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CurrentLap {
  id: string;
  lapTime: number;
  penaltyCount: number;
  createdAt: string;
}

interface CurrentSession {
  id: string;
  driverName: string;
  carName: string;
  locationName: string;
  lapCount: number;
  createdAt: string;
  laps: CurrentLap[];
}

export function CurrentSessionDisplay() {
  const [currentSession, setCurrentSession] = useState<CurrentSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch current session data
  const fetchCurrentSession = async () => {
    try {
      const response = await fetch("/api/current-session/summary");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch current session");
      }

      // Get the most recent session
      const mostRecentSession = data.sessions?.[0] || null;
      setCurrentSession(mostRecentSession);
      setError(null);
    } catch (error) {
      logger.error("Error fetching current session:", error);
      setError("Failed to fetch current session data");
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate session statistics with safety checks
  const calculateSessionStats = (session: CurrentSession) => {
    const lapTimes = session.laps.map((lap) => lap.lapTime);

    return {
      bestLapTime: lapTimes.length > 0 ? Math.min(...lapTimes) : null,
      averageLapTime: lapTimes.length > 0 ? lapTimes.reduce((a, b) => a + b, 0) / lapTimes.length : null,
      totalPenalties: session.laps.reduce((sum, lap) => sum + lap.penaltyCount, 0),
    };
  };

  // New helper function to reverse laps for display
  const getReversedLaps = (laps: CurrentLap[]) => {
    return [...laps].reverse();
  };

  // Set up polling
  useEffect(() => {
    // Initial fetch
    fetchCurrentSession();

    // Poll every 1 second
    const interval = setInterval(fetchCurrentSession, 1000);

    // Cleanup
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading session data...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center p-6 text-red-500">
          <AlertTriangle className="h-6 w-6 mr-2" />
          {error}
        </CardContent>
      </Card>
    );
  }

  if (!currentSession) {
    return (
      <Card className="w-full">
        <CardContent className="flex flex-col items-center justify-center p-6 text-gray-500">
          <Clock className="h-6 w-6 mb-2" />
          <h3 className="text-sm font-semibold">Waiting for next session...</h3>
        </CardContent>
      </Card>
    );
  }

  const stats = calculateSessionStats(currentSession);
  const reversedLaps = getReversedLaps(currentSession.laps);

  return (
    <AnimatePresence mode="wait">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Current Session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Session Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-gray-500">Driver</h3>
                <p className="text-lg font-semibold">{currentSession.driverName}</p>
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-gray-500">Car</h3>
                <p className="text-lg font-semibold">{currentSession.carName}</p>
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-gray-500">Location</h3>
                <p className="text-lg font-semibold">{currentSession.locationName}</p>
              </div>
            </div>

            {/* Session Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Timer className="h-5 w-5 mx-auto mb-2 text-blue-500" />
                    <div className="text-sm font-medium text-gray-500">Laps</div>
                    <div className="text-lg font-semibold">
                      {currentSession.laps.length} / {currentSession.lapCount || "∞"}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Trophy className="h-5 w-5 mx-auto mb-2 text-green-500" />
                    <div className="text-sm font-medium text-gray-500">Best Lap</div>
                    <div className="text-lg font-semibold">{stats.bestLapTime !== null ? formatTime(stats.bestLapTime) : "--:--:--"}</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Clock className="h-5 w-5 mx-auto mb-2 text-yellow-500" />
                    <div className="text-sm font-medium text-gray-500">Average</div>
                    <div className="text-lg font-semibold">{stats.averageLapTime !== null ? formatTime(stats.averageLapTime) : "--:--:--"}</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-red-500" />
                    <div className="text-sm font-medium text-gray-500">Penalties</div>
                    <div className="text-lg font-semibold">{stats.totalPenalties}</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Lap Times */}
            <div className="space-y-2">
              <h3 className="font-semibold">Lap Times (Most Recent First)</h3>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {reversedLaps.map((lap, reversedIndex) => {
                  const originalIndex = currentSession.laps.length - reversedIndex - 1;
                  const isBestLap = stats.bestLapTime !== null && lap.lapTime === stats.bestLapTime;
                  return (
                    <motion.div key={lap.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className={`p-2 rounded-lg ${isBestLap ? "bg-green-50 border border-green-200" : "bg-gray-50"}`}>
                      <div className="flex justify-between items-center">
                        <span className="font-mono">
                          Lap {originalIndex + 1}: {formatTime(lap.lapTime)}
                        </span>
                        {lap.penaltyCount > 0 && (
                          <span className="text-sm text-red-500">
                            {lap.penaltyCount} {lap.penaltyCount === 1 ? "Penalty" : "Penalties"}
                          </span>
                        )}
                        {isBestLap && <span className="text-sm text-green-600 font-semibold">Best Lap!</span>}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Session Start Time */}
            <div className="text-sm text-gray-500 text-right">Session started: {formatDateTime(currentSession.createdAt)}</div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
  
}
