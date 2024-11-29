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

  const voiceAnnouncementsRef = useRef(voiceAnnouncements);
  // Sync with the ref whenever it changes
  useEffect(() => {
    voiceAnnouncementsRef.current = voiceAnnouncements;
  }, [voiceAnnouncements]);

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

      playRaceFinish();
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

      // TODO: should the first detection be ignored?
      if (!lastDetection) {
        // First detection for this car
        setLastDetectionTimes((prev) => new Map(prev).set(carId, detectionTime));
        return; // Don't count the start line crossing as a lap
      }

      playBeep();
      sayIt("Car " + carId);

      // Update lap count
      setLapCounts((prev) => {
        const newMap = new Map(prev);
        const currentCount = newMap.get(carId) || 0;
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

    const allCarsFinished = Array.from(allowedCarNumbers).every((carNumber) => {
      const currentLaps = lapCounts.get(carNumber) || 0;
      const finished = currentLaps >= (typeof totalLaps === "number" ? totalLaps : Infinity);

      return finished;
    });

    if (allCarsFinished) {
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
    } catch (error) {
      console.error("Error starting race:", error);
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

      if (!race.id) {
        throw new Error("No race ID returned from server");
      }

      // 2. Set race ID in state
      setRaceId(race.id);
      setAllowedCarNumbers(race.entries.map((e: any) => e.carNumber.toString()));

      // 3. Start countdown
      const initiateCountdown = async () => {
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

  const boardPositions = Array.from(allowedCarNumbers).map((carNum) => ({
    carNumber: parseInt(carNum),
    position: carPositions.get(carNum) || 0,
    lapsCompleted: lapCounts.get(carNum) || 0,
    lastLapTime: lastLapTimes.get(carNum),
    bestLapTime: bestLapTimes.get(carNum),
    gap: calculateGapToLeader(carNum),
    status: "RACING",
  }));

  const playBeep = ({ frequency = 440, duration = 200, volume = 0.5, type = "square" }: BeepOptions = {}): Promise<void> => {
    if (playBeeps) {
      return new Promise((resolve) => {
        // Create audio context
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

        // Create oscillator and gain node
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        // Configure oscillator
        oscillator.type = type;
        oscillator.frequency.value = frequency;

        // Configure gain (volume)
        gainNode.gain.value = volume;

        // Connect nodes
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Schedule the beep
        oscillator.start();

        // Schedule the end of the beep
        setTimeout(() => {
          oscillator.stop();
          audioContext.close();
          resolve();
        }, duration);
      });
    }
  };

  const playRaceFinish = async (): Promise<void> => {
    if (playBeeps) {
      // Quick ascending beeps followed by victory tone
      const ascendingBeeps = [
        { frequency: 440, duration: 100 },
        { frequency: 554, duration: 100 },
        { frequency: 659, duration: 100 },
        { frequency: 880, duration: 100 },
      ];

      // Play ascending beeps
      for (const beep of ascendingBeeps) {
        await playBeep({
          frequency: beep.frequency,
          duration: beep.duration,
          volume: 0.5,
          type: "square",
        });
        // Small gap between beeps
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      // Victory fanfare
      await playBeep({
        frequency: 880,
        duration: 150,
        volume: 0.6,
        type: "triangle",
      });

      // Final sustained victory note
      await playBeep({
        frequency: 1320,
        duration: 400,
        volume: 0.7,
        type: "square",
      });
    }
  };

  // Say something
  const sayIt = useCallback(async (textToSpeak: string): Promise<boolean> => {
    if (!voiceAnnouncementsRef.current) {
      return false;
    }

    try {
      // Force cancel and wait for cleanup
      window.speechSynthesis.cancel();
      await new Promise((resolve) => setTimeout(resolve, 500)); // <-- wait time

      const utterance = new SpeechSynthesisUtterance(textToSpeak);

      // TODO: change settings?
      utterance.rate = 1.2;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      utterance.lang = "en-US"; // Force English language

      // Wait for voices to be loaded
      const setVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        // First try to find Google US English voice
        let preferredVoice = voices.find((voice) => voice.name.includes("Google US English") || voice.name.includes("en-US"));

        // If no Google US voice, try any English voice
        if (!preferredVoice) {
          preferredVoice = voices.find((voice) => voice.lang.startsWith("en"));
        }

        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
      };

      // Check if voices are already loaded
      if (window.speechSynthesis.getVoices().length) {
        setVoice();
      } else {
        // Wait for voices to be loaded
        window.speechSynthesis.onvoiceschanged = setVoice;
      }

      window.speechSynthesis.speak(utterance);

      return true;
    } catch {
      return false;
    }
  }, []);

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
              <RacePositionBoard positions={boardPositions} />

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
