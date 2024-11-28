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
  const [carPositions, setCarPositions] = useState<Map<string, number>>(new Map());
  const [lapCounts, setLapCounts] = useState<Map<string, number>>(new Map());
  const [lastLapTimes, setLastLapTimes] = useState<Map<string, number>>(new Map());
  const [bestLapTimes, setBestLapTimes] = useState<Map<string, number>>(new Map());
  const [lastDetectionTimes, setLastDetectionTimes] = useState<Map<string, number>>(new Map());
  const [allowedCarNumbers, setAllowedCarNumbers] = useState<string[]>([]);
  const [raceStartTime, setRaceStartTime] = useState<number | null>(null);

  // Settings
  const [playBeeps, setPlayBeeps] = useState(true);
  const [voiceAnnouncements, setVoiceAnnouncements] = useState(true);

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

  // Handle IR detection
  const handleCarDetected = useCallback(
    async (carId: string, timestamp: string) => {
      if (raceStatus !== "RACING") return;

      const detectionTime = new Date(timestamp).getTime();
      const lastDetection = lastDetectionTimes.get(carId) || raceStartTime;

      console.log("Car Detection:", {
        carId,
        timestamp,
        detectionTime,
        lastDetection,
        currentLaps: lapCounts.get(carId) || 0,
      });

      if (!lastDetection) {
        // First detection for this car
        setLastDetectionTimes((prev) => new Map(prev).set(carId, detectionTime));
        return; // Don't count the start line crossing as a lap
      }

      // Update lap count
      setLapCounts((prev) => {
        const newMap = new Map(prev);
        const currentCount = newMap.get(carId) || 0;
        console.log(`Updating lap count for car ${carId} from ${currentCount} to ${currentCount + 1}`);
        newMap.set(carId, currentCount + 1);
        return newMap;
      });

      // Calculate lap time
      const lapTime = detectionTime - lastDetection;

      // Update last lap time
      setLastLapTimes((prev) => new Map(prev).set(carId, lapTime));

      // Update best lap time if this is the best
      setBestLapTimes((prev) => {
        const currentBest = prev.get(carId) || Infinity;
        return new Map(prev).set(carId, Math.min(currentBest, lapTime));
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
    },
    [raceId, raceStatus, raceStartTime, lastDetectionTimes]
  );

  // Handle race completion
  useEffect(() => {
    if (raceStatus !== "RACING" || totalLaps === "unlimited") return;

    // Log for debugging
    console.log("Checking race completion:", {
      totalLaps,
      currentLaps: Object.fromEntries(lapCounts),
      allowedCars: allowedCarNumbers,
    });

    const allCarsFinished = Array.from(allowedCarNumbers).every((carNumber) => {
      const currentLaps = lapCounts.get(carNumber) || 0;
      const finished = currentLaps >= (typeof totalLaps === "number" ? totalLaps : Infinity);

      // Log individual car progress
      console.log(`Car ${carNumber}: ${currentLaps}/${totalLaps} laps`);

      return finished;
    });

    if (allCarsFinished) {
      console.log("All cars finished, stopping race");
      stopRace();
    }
  }, [raceStatus, totalLaps, allowedCarNumbers, lapCounts]);

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

  // Start the race
  const startRace = async (raceId: string) => {
    if (!raceId) {
      console.error("No race ID provided to startRace");
      return;
    }

    try {
      const response = await fetch(`/api/races/${raceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "RACING" }),
      });

      if (!response.ok) {
        throw new Error("Failed to start race");
      }

      const startTime = Date.now();
      setRaceStartTime(startTime);
      setRaceStatus("RACING");

      // Clear previous race data and ensure we're creating new Maps
      const emptyMap = new Map();
      setLapCounts(new Map());
      setLastLapTimes(new Map());
      setBestLapTimes(new Map());
      setLastDetectionTimes(new Map());
      setCarPositions(new Map());

      console.log("Maps cleared at race start:", {
        lapCounts: Object.fromEntries(emptyMap),
        lastLapTimes: Object.fromEntries(emptyMap),
        bestLapTimes: Object.fromEntries(emptyMap),
        lastDetectionTimes: Object.fromEntries(emptyMap),
        carPositions: Object.fromEntries(emptyMap),
      });
    } catch (error) {
      console.error("Error starting race:", error);
    }
  };

  // Fetch current race state
  const updateRaceStateOld = async () => {
    if (!raceId) return;
  
    try {
      const response = await fetch(`/api/races/${raceId}/state`);
      if (!response.ok) {
        throw new Error("Failed to fetch race state");
      }
  
      const data = await response.json();
      
      // Convert API response to Map
      const positionsMap = new Map(
        data.entries.map(entry => [entry.carNumber.toString(), entry.position])
      );
      setCarPositions(positionsMap);
      
      // Update other state from API response
      const lapCountsMap = new Map(
        data.entries.map(entry => [entry.carNumber.toString(), entry.lapsCompleted])
      );
      setLapCounts(lapCountsMap);
      
      setRaceStatus(data.status);
    } catch (error) {
      logger.error("Error fetching race state:", error);
    }
  };
  const updateRaceState = async () => {
    if (!raceId) return;
  
    try {
      const response = await fetch(`/api/races/${raceId}/state`);
      if (!response.ok) {
        throw new Error("Failed to fetch race state");
      }
  
      const data = await response.json();
      // Only update race status from API, keep local lap counts
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
      // 1. Create race
      const response = await fetch("/api/races", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error(`Failed to create race: ${response.status}`);
      }

      const race = await response.json();
      console.log("Race created:", race);

      if (!race.id) {
        throw new Error("No race ID returned from server");
      }

      // 2. Set race ID in state
      setRaceId(race.id);
      setAllowedCarNumbers(race.entries.map((e: any) => e.carNumber.toString()));

      // 3. Start countdown
      const initiateCountdown = async () => {
        console.log("Initiating countdown with raceId:", race.id);
        try {
          const countdownResponse = await fetch(`/api/races/${race.id}/countdown/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
              startRace(race.id); // Pass race ID explicitly
            }
          }, 1000);
        } catch (error) {
          console.error("Error in countdown initiation:", error);
          throw error;
        }
      };

      await initiateCountdown();
    } catch (error) {
      console.error("Error in race configuration:", error);
      // Add user feedback here
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
              {console.log("Lap Counts Map:", Object.fromEntries(lapCounts))}
              {console.log("Is lapCounts a Map?", lapCounts instanceof Map)}

              <RacePositionBoard
                positions={Array.from(allowedCarNumbers).map((carNum) => {
                  // Ensure we're working with valid Maps
                  const currentLapCounts = lapCounts instanceof Map ? lapCounts : new Map();
                  const currentPositions = carPositions instanceof Map ? carPositions : new Map();
                  const currentLastLapTimes = lastLapTimes instanceof Map ? lastLapTimes : new Map();
                  const currentBestLapTimes = bestLapTimes instanceof Map ? bestLapTimes : new Map();

                  console.log(`Car ${carNum} laps:`, currentLapCounts.get(carNum));

                  return {
                    carNumber: parseInt(carNum),
                    position: currentPositions.get(carNum) || 0,
                    lapsCompleted: currentLapCounts.get(carNum) || 0,
                    lastLapTime: currentLastLapTimes.get(carNum),
                    bestLapTime: currentBestLapTimes.get(carNum),
                    gap: calculateGapToLeader(carNum),
                    status: "RACING",
                  };
                })}
              />
              <div className="mt-4">
                <RaceControls isPaused={isPaused} onPauseResume={togglePause} onStop={stopRace} onDNF={markDNF} availableCarNumbers={allowedCarNumbers.map((num) => parseInt(num))} />
              </div>
            </>
          )}

          {raceStatus === "FINISHED" && (
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4">Race Complete!</h2>
              <RacePositionBoard
                positions={Array.from(allowedCarNumbers).map((carNum) => ({
                  carNumber: parseInt(carNum),
                  position: (carPositions instanceof Map ? carPositions : new Map()).get(carNum) || 0,
                  lapsCompleted: (lapCounts instanceof Map ? lapCounts : new Map()).get(carNum) || 0,
                  lastLapTime: (lastLapTimes instanceof Map ? lastLapTimes : new Map()).get(carNum),
                  bestLapTime: (bestLapTimes instanceof Map ? bestLapTimes : new Map()).get(carNum),
                  gap: calculateGapToLeader(carNum),
                  status: "FINISHED",
                }))}
              />
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
