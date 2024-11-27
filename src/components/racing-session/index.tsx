// src/components/racing-session/index.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RaceConfigForm } from "./race-config-form";
import { RacePositionBoard } from "./race-position-board";
import { RaceControls } from "./race-controls";
import { RaceCountdown } from "./race-countdown";
import IRDetector from "@/components/ir-detector";
import { RaceStatus, RaceEntryStatus } from "@/types/race-timer";
import { logger } from "@/lib/logger";

interface RacingSessionProps {
  onRaceComplete?: () => void;
}

export const RacingSession: React.FC<RacingSessionProps> = ({ onRaceComplete }) => {
  // Timer ref for cleanup
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Race state
  const [raceId, setRaceId] = useState<string | null>(null);
  const [raceStatus, setRaceStatus] = useState<RaceStatus>("PENDING");
  const [countdownTime, setCountdownTime] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [startDelay, setStartDelay] = useState(5); // Default 5 second delay
  const [totalLaps, setTotalLaps] = useState<number | "unlimited">("unlimited");

  // IR Detection state
  const [allowedCarNumbers, setAllowedCarNumbers] = useState<string[]>([]);
  const [carPositions, setCarPositions] = useState<Map<string, number>>(new Map());
  const [lapCounts, setLapCounts] = useState<Map<string, number>>(new Map());
  const [lastLapTimes, setLastLapTimes] = useState<Map<string, number>>(new Map());
  const [bestLapTimes, setBestLapTimes] = useState<Map<string, number>>(new Map());
  const [lastDetectionTimes, setLastDetectionTimes] = useState<Map<string, number>>(new Map());
  const [raceStartTime, setRaceStartTime] = useState<number | null>(null);

  // Settings
  const [playBeeps, setPlayBeeps] = useState(true);
  const [voiceAnnouncements, setVoiceAnnouncements] = useState(true);

  // Handle IR detection
  const handleCarDetected = useCallback(
    async (carId: string, timestamp: string) => {
      if (raceStatus !== "RACING") return;

      const detectionTime = new Date(timestamp).getTime();

      // Get previous detection time for this car
      const lastDetection = lastDetectionTimes.get(carId) || raceStartTime;

      if (lastDetection) {
        const lapTime = detectionTime - lastDetection;

        // Update last lap time
        setLastLapTimes((prev) => new Map(prev).set(carId, lapTime));

        // Update best lap time if this is the best
        setBestLapTimes((prev) => {
          const currentBest = prev.get(carId) || Infinity;
          return new Map(prev).set(carId, Math.min(currentBest, lapTime));
        });

        // Update lap count
        setLapCounts((prev) => {
          const currentCount = prev.get(carId) || 0;
          return new Map(prev).set(carId, currentCount + 1);
        });

        // Record detection for future lap times
        setLastDetectionTimes((prev) => new Map(prev).set(carId, detectionTime));

        try {
          // Record lap in database
          const response = await fetch(`/api/races/${raceId}/laps`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              carNumber: parseInt(carId),
              timestamp: detectionTime,
              lapTime: lapTime,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to record lap");
          }

          // Calculate new positions based on lap counts
          calculatePositions();
        } catch (error) {
          logger.error("Error recording lap:", error);
        }
      } else {
        // First detection for this car
        setLastDetectionTimes((prev) => new Map(prev).set(carId, detectionTime));
      }
    },
    [raceId, raceStatus, raceStartTime, lastDetectionTimes]
  );

  // Calculate race positions based on lap counts and detection times
  const calculatePositions = useCallback(() => {
    const cars = Array.from(lapCounts.keys());

    // Sort cars by lap count (descending) and last detection time (ascending)
    cars.sort((a, b) => {
      const aLaps = lapCounts.get(a) || 0;
      const bLaps = lapCounts.get(b) || 0;

      if (aLaps !== bLaps) {
        return bLaps - aLaps;
      }

      const aTime = lastDetectionTimes.get(a) || Infinity;
      const bTime = lastDetectionTimes.get(b) || Infinity;
      return aTime - bTime;
    });

    // Update positions
    const newPositions = new Map();
    cars.forEach((car, index) => {
      newPositions.set(car, index + 1);
    });

    setCarPositions(newPositions);
  }, [lapCounts, lastDetectionTimes]);

  // Start race countdown
  const startCountdown = async (delay: number) => {
    if (!raceId) {
      console.error("Cannot start countdown without a race ID");
      return;
    }

    try {
      const response = await fetch(`/api/races/${raceId}/countdown/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ duration: delay * 1000 }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to start countdown");
      }

      setRaceStatus("COUNTDOWN");
      setCountdownTime(delay);

      let timeLeft = delay;
      timerRef.current = setInterval(() => {
        timeLeft -= 1;
        setCountdownTime(timeLeft);

        if (timeLeft <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          startRace();
        }
      }, 1000);
    } catch (error) {
      console.error("Error starting countdown:", error);
      throw error;
    }
  };

  // Start the race
  const startRace = async () => {
    try {
      const response = await fetch(`/api/races/${raceId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "RACING" }),
      });

      if (!response.ok) {
        throw new Error("Failed to start race");
      }

      const startTime = Date.now();
      setRaceStartTime(startTime);
      setRaceStatus("RACING");

      // Clear any previous race data
      setLapCounts(new Map());
      setLastLapTimes(new Map());
      setBestLapTimes(new Map());
      setLastDetectionTimes(new Map());
      setCarPositions(new Map());
    } catch (error) {
      logger.error("Error starting race:", error);
    }
  };

  // Fetch current race state
  const updateRaceState = async () => {
    if (!raceId) return;

    try {
      const response = await fetch(`/api/races/${raceId}/state`);
      if (!response.ok) {
        throw new Error("Failed to fetch race state");
      }

      const data = await response.json();
      setPositions(data.entries);
      setRaceStatus(data.status);
    } catch (error) {
      logger.error("Error fetching race state:", error);
    }
  };

  // Pause/Resume race
  const togglePause = async () => {
    try {
      const action = isPaused ? "resume" : "pause";
      const response = await fetch(`/api/races/${raceId}/${action}`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} race`);
      }

      setIsPaused(!isPaused); // Using our state

      if (isPaused) {
        // Resume timer
        timerRef.current = setInterval(() => {
          setElapsedTime((prev) => prev + 1000);
        }, 1000);
      } else {
        // Pause timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      }
    } catch (error) {
      logger.error(`Error ${isPaused ? "resuming" : "pausing"} race:`, error);
    }
  };

  // Stop race
  const stopRace = async () => {
    try {
      const response = await fetch(`/api/races/${raceId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "FINISHED" }),
      });

      if (!response.ok) {
        throw new Error("Failed to stop race");
      }

      setRaceStatus("FINISHED");
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      onRaceComplete?.();
    } catch (error) {
      logger.error("Error stopping race:", error);
    }
  };

  // Mark car as DNF
  const markDNF = async (carNumber: number, reason?: string) => {
    try {
      const response = await fetch(`/api/races/${raceId}/dnf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ carNumber, reason }),
      });

      if (!response.ok) {
        throw new Error("Failed to mark DNF");
      }

      await updateRaceState();
    } catch (error) {
      logger.error("Error marking DNF:", error);
    }
  };

  const calculateGapToLeader = useCallback(
    (carNumber: string) => {
      if (!lastDetectionTimes.has(carNumber)) return undefined;

      // Find the leader
      const leader = Array.from(carPositions.entries()).find(([_, pos]) => pos === 1)?.[0];

      if (!leader || leader === carNumber) return 0;

      // Calculate time difference between last detections
      const carTime = lastDetectionTimes.get(carNumber)!;
      const leaderTime = lastDetectionTimes.get(leader)!;

      return carTime - leaderTime;
    },
    [lastDetectionTimes, carPositions]
  );

  const onRaceConfigured = async (config: any) => {
    console.log("Creating race with config:", config);
    try {
      const response = await fetch("/api/races", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error("Failed to create race");
      }

      const race = await response.json();
      console.log("Race created:", race);

      // First update state
      setRaceId(race.id);
      setAllowedCarNumbers(race.entries.map((e: any) => e.carNumber.toString()));

      // Create a separate function for countdown
      const initiateCountdown = async () => {
        console.log("Initiating countdown with raceId:", race.id); // Debug log
        try {
          const countdownResponse = await fetch(`/api/races/${race.id}/countdown/start`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ duration: config.startDelay * 1000 }),
          });

          if (!countdownResponse.ok) {
            throw new Error("Failed to start countdown");
          }

          setRaceStatus("COUNTDOWN");
          setCountdownTime(config.startDelay);

          let timeLeft = config.startDelay;
          timerRef.current = setInterval(() => {
            timeLeft -= 1;
            setCountdownTime(timeLeft);

            if (timeLeft <= 0) {
              if (timerRef.current) clearInterval(timerRef.current);
              startRace();
            }
          }, 1000);
        } catch (error) {
          console.error("Error in countdown initiation:", error);
        }
      };

      // Start countdown directly using race.id instead of relying on state
      await initiateCountdown();
    } catch (error) {
      console.error("Error creating race:", error);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Update race state periodically when race is active
  useEffect(() => {
    if (raceStatus === "RACING" && !isPaused) {
      const interval = setInterval(updateRaceState, 1000);
      return () => clearInterval(interval);
    }
  }, [raceStatus, isPaused]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Race Session</CardTitle>
        </CardHeader>
        <CardContent>
          {raceStatus === "PENDING" && (
            <RaceConfigForm
              onConfigured={onRaceConfigured}
              startDelay={startDelay}
              onStartDelayChange={setStartDelay}
              totalLaps={totalLaps}
              onTotalLapsChange={setTotalLaps}
              playBeeps={playBeeps}
              onPlayBeepsChange={setPlayBeeps}
              voiceAnnouncements={voiceAnnouncements}
              onVoiceAnnouncementsChange={setVoiceAnnouncements}
            />
          )}

          {raceStatus === "COUNTDOWN" && <RaceCountdown timeLeft={countdownTime || 0} playBeeps={playBeeps} voiceAnnouncements={voiceAnnouncements} />}

          {(raceStatus === "RACING" || raceStatus === "PAUSED") && (
            <>
              <RacePositionBoard
                positions={Array.from(allowedCarNumbers).map((carNum) => ({
                  carNumber: parseInt(carNum),
                  position: carPositions.get(carNum) || 0,
                  lapsCompleted: lapCounts.get(carNum) || 0,
                  lastLapTime: lastLapTimes.get(carNum),
                  bestLapTime: bestLapTimes.get(carNum),
                  gap: calculateGapToLeader(carNum),
                  status: "RACING",
                }))}
              />
              <div className="mt-4">
                <RaceControls isPaused={isPaused} onPauseResume={togglePause} onStop={stopRace} onDNF={markDNF} availableCarNumbers={allowedCarNumbers.map((num) => parseInt(num))} />
              </div>
            </>
          )}

          {raceStatus === "FINISHED" && (
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4">Race Complete!</h2>
              <RacePositionBoard positions={positions} />
            </div>
          )}

          {/* IR Detector */}
          {(raceStatus === "RACING" || raceStatus === "COUNTDOWN") && (
            <div className="mt-4">
              <IRDetector allowedCarNumbers={allowedCarNumbers} onCarDetected={handleCarDetected} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
