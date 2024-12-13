"use client";

// ****************************************
// import
// ****************************************
import { formatTime, formatDateTime } from "@/lib/utils";
import { SessionComparison } from "./session-comparison";
import { SessionNotes } from "./session-notes";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, ListX, Trophy, AlertTriangle, PlayCircle, StopCircle, ListPlus, Trash2, User, Car as CarIcon, Turtle, Zap, MapPin, ChartArea, NotebookPen, ClipboardList, CirclePlay } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addDays, format, isBefore, isAfter, startOfDay, endOfDay, parseISO } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, UserCog } from "lucide-react";
import cn from "classnames";
import { BestLapsComparison } from "./best-laps-comparison";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { Driver, Car, Session, LapStats, PenaltyData } from "@/types/rc-timer";
import { MotionDetector } from "./motion-detector";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { logger } from "@/lib/logger";
import { SessionRequestForm } from "../session-request-form";
import { CurrentSessionDisplay } from "@/components/current-session-display";
import axios from "axios";
import { LEDDeviceService } from "@/services/ledDevice";
import { Location } from "@/types/rc-timer";

// ****************************************
// interface
// ****************************************
interface BeepOptions {
  frequency?: number;
  duration?: number;
  volume?: number;
  type?: OscillatorType;
}

interface CarDetection {
  id: string;
  time: string;
}

interface CooldownMap {
  [carId: string]: number;
}

export default function PracticeControl() {
  // ****************************************
  // useState
  // ****************************************
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [laps, setLaps] = useState<number[]>([]);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<string | null>(null);
  const [selectedLapCount, setSelectedLapCount] = useState<"unlimited" | number>("unlimited");
  const [inputLapCount, setInputLapCount] = useState<string>("");
  const [showLapCountInput, setShowLapCountInput] = useState<boolean>(false);
  const [startAnimation, setStartAnimation] = useState(false);
  const [lapAnimation, setLapAnimation] = useState(false);
  const [stopAnimation, setStopAnimation] = useState(false);
  const [penalties, setPenalties] = useState<PenaltyData[]>([]);
  const [penaltyAnimation, setPenaltyAnimation] = useState(false);
  const [activeTab, setActiveTab] = useState("current");
  const [isMobile, setIsMobile] = useState(false);
  const [filterDriver, setFilterDriver] = useState<string>("all");
  const [filterCar, setFilterCar] = useState<string>("all");
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string>("");
  const [selectedCar, setSelectedCar] = useState<string>("");
  const [savedSessions, setSavedSessions] = useState<Session[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timer | null>(null);
  const [timingMode, setTimingMode] = useState<string>("ui");
  const [showMotionDetector, setShowMotionDetector] = useState(false);
  const [isMotionTimingActive, setIsMotionTimingActive] = useState(false);
  const [announceLapNumber, setAnnounceLapNumber] = useState(false);
  const [announceLastLapTime, setAnnounceLastLapTime] = useState(false);
  const [speechVoice, setSpeechVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [playBeeps, setPlayBeeps] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [remoteControlActive, setRemoteControlActive] = useState(false);

  const [addEditDialogState, setAddEditDialogState] = useState<{
    isOpen: boolean;
    type: "driver" | "car" | "location" | null;
    action: "add" | null;
    entityName: string;
    defaultCarNumber?: number;
  }>({
    isOpen: false,
    type: null,
    action: null,
    entityName: "",
    defaultCarNumber: undefined,
  });

  const [ledDevice] = useState(() => new LEDDeviceService());

  // ****************************************
  // useRef
  // ****************************************
  const remoteControlIntervalRef = useRef<NodeJS.Timeout>();
  const motionControlRef = useRef<{ stop: () => void; start: () => Promise<void> }>(null);
  const announceLapNumberRef = useRef(announceLapNumber);

  // ****************************************
  // useEffect
  // ****************************************
  // Sync with the ref whenever it changes
  useEffect(() => {
    announceLapNumberRef.current = announceLapNumber;
  }, [announceLapNumber]);

  const announceLastLapTimeRef = useRef(announceLastLapTime);
  // Sync with the ref whenever it changes
  useEffect(() => {
    announceLastLapTimeRef.current = announceLastLapTime;
  }, [announceLastLapTime]);

  const playBeepsRef = useRef(playBeeps);
  // Sync with the ref whenever it changes
  useEffect(() => {
    playBeepsRef.current = playBeeps;
  }, [playBeeps]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const isRunningRef = useRef(isRunning);
  // Sync with the ref whenever it changes
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  const lapsRef = useRef(laps);
  // Sync with the ref whenever it changes
  useEffect(() => {
    lapsRef.current = laps;
  }, [laps]);

  const currentTimeRef = useRef(currentTime);
  // Sync with the ref whenever it changes
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  const startTimeRef = useRef(startTime);
  // Sync with the ref whenever it changes
  useEffect(() => {
    startTimeRef.current = startTime;
  }, [startTime]);

  const selectedLapCountRef = useRef(selectedLapCount);
  // Sync with the ref whenever it changes
  useEffect(() => {
    selectedLapCountRef.current = selectedLapCount;
  }, [selectedLapCount]);

  const selectedDriverRef = useRef(selectedDriver);
  // Sync with the ref whenever it changes
  useEffect(() => {
    selectedDriverRef.current = selectedDriver;
  }, [selectedDriver]);

  const selectedCarRef = useRef(selectedCar);
  // Sync with the ref whenever it changes
  useEffect(() => {
    selectedCarRef.current = selectedCar;
  }, [selectedCar]);

  const selectedLocationRef = useRef(selectedLocation);
  // Sync with the ref whenever it changes
  useEffect(() => {
    selectedLocationRef.current = selectedLocation;
  }, [selectedLocation]);

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

  useEffect(() => {
    try {
      const storedSessions = localStorage.getItem("rc-lap-timer-sessions");
      const storedDrivers = localStorage.getItem("rc-lap-timer-drivers");

      if (storedSessions) setSavedSessions(JSON.parse(storedSessions));
      if (storedDrivers) setDrivers(JSON.parse(storedDrivers));
    } catch (error) {
      logger.error("Error loading saved data:", error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("rc-lap-timer-sessions", JSON.stringify(savedSessions));
  }, [savedSessions]);

  useEffect(() => {
    localStorage.setItem("rc-lap-timer-drivers", JSON.stringify(drivers));
  }, [drivers]);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setCurrentTime(Date.now() - startTime!);
      }, 10);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning, startTime]);

  // Load data on component mount
  useEffect(() => {
    loadSavedData();
  }, []);

  // Auto-save whenever sessions or drivers change
  useEffect(() => {
    if (savedSessions.length > 0 || drivers.length > 0) {
      saveData();
    }
  }, [savedSessions, drivers]);

  // useEffect to initialize the date range
  useEffect(() => {
    setPreviousSessionsDateRange({
      from: startOfDay(new Date()),
      to: endOfDay(new Date()),
    });
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

  // Update the useEffect for voice handling
  useEffect(() => {
    // Function to get and set available voices
    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      // Filter for English voices
      const englishVoices = voices.filter((voice) => voice.lang.startsWith("en-"));

      setAvailableVoices(englishVoices);

      // If no voice is selected, set the default
      if (!speechVoice) {
        // Try to find Google US English
        const googleUsVoice = voices.find((voice) => voice.name === "Google US English");

        if (googleUsVoice) {
          setSpeechVoice(googleUsVoice);
        } else {
          // Fallback to any US English voice
          const usEnglishVoice = voices.find((voice) => voice.lang === "en-US");

          if (usEnglishVoice) {
            setSpeechVoice(usEnglishVoice);
          } else {
            // Final fallback to any English voice
            const anyEnglishVoice = englishVoices[0];
            if (anyEnglishVoice) {
              setSpeechVoice(anyEnglishVoice);
            }
          }
        }
      }
    };

    // Initial attempt to get voices
    updateVoices();

    // Set up event listener for when voices are loaded
    window.speechSynthesis.onvoiceschanged = updateVoices;

    // Cleanup
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [speechVoice]); // Added speechVoice to dependency array to properly track its state

  // TODO: move to top of file w/ rest of interfaces
  interface DatePreset {
    label: string;
    days: number | "month" | "year";
  }

  // ****************************************
  // const
  // ****************************************
  const DATE_PRESETS: DatePreset[] = [
    { label: "Today", days: 0 },
    { label: "Last 7 days", days: 7 },
    { label: "Last 30 days", days: 30 },
    { label: "Last 90 days", days: 90 },
    { label: "This month", days: "month" },
    { label: "This year", days: "year" },
  ];

  const [previousSessionsDateRange, setPreviousSessionsDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>(() => ({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  }));

  const addPenalty = () => {
    if (!isRunning) return;

    setPenaltyAnimation(true);
    setTimeout(() => setPenaltyAnimation(false), 300);

    const currentLapNumber = laps.length + 1;

    logCurrentSessionAddPenalty(currentLapNumber);

    setPenalties((prev) => {
      const existingPenalty = prev.find((p) => p.lapNumber === currentLapNumber);
      if (existingPenalty) {
        return prev.map((p) => (p.lapNumber === currentLapNumber ? { ...p, count: p.count + 1 } : p));
      }
      return [...prev, { lapNumber: currentLapNumber, count: 1 }];
    });

    ledDevice.displayMessage("Penalty   Recorded", `Penalty recorded on  lap number ${currentLapNumber}`);
    flashPenalty();
  };

  // ************************************************************************************************
  // announcements
  // ************************************************************************************************

  // Add this effect to keep speech synthesis active
  useEffect(() => {
    const resumeInterval = setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        window.speechSynthesis.resume();
      }
    }, 100);

    return () => clearInterval(resumeInterval);
  }, []);

  const announceRaceBegin = useCallback(async () => {
    if (announceLapNumberRef.current) {
      var didTTSWork = await sayIt("Timing Session Started");
    }
  }, []);

  // Add this effect to manage speech synthesis state globally
  useEffect(() => {
    let resumeInterval: NodeJS.Timeout;

    const setupSpeechSynthesis = () => {
      if (!window.speechSynthesis) return;

      // Initial setup
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();

      // Keep speech synthesis active
      resumeInterval = setInterval(() => {
        if (window.speechSynthesis) {
          window.speechSynthesis.resume();
        }
      }, 250); // More frequent resume calls
    };

    setupSpeechSynthesis();

    // Cleanup function
    return () => {
      if (resumeInterval) {
        clearInterval(resumeInterval);
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Add this useEffect to manage speech synthesis state
  useEffect(() => {
    let resumeInterval: NodeJS.Timeout;

    if (window.speechSynthesis) {
      // Keep speech synthesis active
      resumeInterval = setInterval(() => {
        if (!window.speechSynthesis.speaking) {
          window.speechSynthesis.resume();
        }
      }, 100);
    }

    return () => {
      if (resumeInterval) {
        clearInterval(resumeInterval);
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const announceRaceInfo = useCallback(async (lapNumber: number, lastLapTime?: number, sessionEnded: boolean = false) => {
    var announcement = "";

    if (sessionEnded && announceLapNumberRef.current) {
      announcement += "Timing Session Ended.";
    } else if (announceLapNumberRef.current) {
      announcement += `Lap ${lapNumber} started.`;
    }

    if (announceLastLapTimeRef.current && lastLapTime !== undefined) {
      announcement += `Last lap time ${formatTimeForSpeech(lastLapTime)}`;
    }

    var didTTSWork = await sayIt(announcement);
  }, []);

  const speechVoiceRef = useRef(speechVoice);
  // Sync with the ref whenever it changes
  useEffect(() => {
    speechVoiceRef.current = speechVoice;
  }, [speechVoice]);

  // Say something
  const sayIt = useCallback(async (textToSpeak: string): Promise<boolean> => {
    try {
      // Force cancel and wait for cleanup
      window.speechSynthesis.cancel();
      await new Promise((resolve) => setTimeout(resolve, 500)); // <-- wait time

      const utterance = new SpeechSynthesisUtterance(textToSpeak);

      // TODO: change settings?
      utterance.rate = 1.2;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Configure speech parameters
      if (speechVoiceRef.current) {
        utterance.voice = speechVoiceRef.current;
      }

      window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);

      // Pause between announcements
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return true;
    } catch {
      return false;
    }
  }, []);

  // ************************************************************************************************
  // ************************************************************************************************
  // ************************************************************************************************

  const calculateStats = (laps: number[]): LapStats => {
    if (laps.length === 0) {
      return {
        average: 0,
        totalTime: 0,
        bestLap: 0,
        worstLap: 0,
        maxPenaltyLap: null,
        maxPenaltyCount: 0,
      };
    }

    const sum = laps.reduce((a, b) => a + b, 0);
    const average = sum / laps.length;
    const sortedLaps = [...laps].sort((a, b) => a - b);
    const bestLap = sortedLaps[0];
    const worstLap = sortedLaps[sortedLaps.length - 1];

    // Find the lap with most penalties
    let maxPenaltyLap = null;
    let maxPenaltyCount = 0;

    penalties.forEach((penalty) => {
      if (penalty.count > maxPenaltyCount) {
        maxPenaltyCount = penalty.count;
        maxPenaltyLap = penalty.lapNumber;
      }
    });

    return {
      average,
      totalTime: sum,
      bestLap,
      worstLap,
      maxPenaltyLap,
      maxPenaltyCount,
    };
  };

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

  const deleteSession = async (sessionId: string): Promise<void> => {
    setIsDeleting(true);
    try {
      // Ensure sessionId is a string
      const stringSessionId = sessionId.toString();

      const response = await fetch("/api/data", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: stringSessionId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        logger.error("Delete response error:", errorData); // Debug log
        throw new Error(errorData.error || "Failed to delete session");
      }

      const data = await response.json();

      if (data.success) {
        // Update local state only after successful deletion
        setSavedSessions((prevSessions) => prevSessions.filter((session) => session.id !== stringSessionId));
        setSessionToDelete(null);
      } else {
        throw new Error("Server indicated deletion was not successful");
      }
    } catch (error) {
      logger.error("Error deleting session:", error);
      alert("Failed to delete session. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const formatTimeForSpeech = (time: number): string => {
    const minutes = Math.floor(time / 60000);
    const seconds = Math.floor((time % 60000) / 1000);
    const milliseconds = Math.floor((time % 1000) / 10);

    // Format milliseconds to always have two digits
    const formattedMilliseconds = milliseconds.toString().padStart(2, "0");

    if (minutes > 0) {
      return `${minutes} minute${minutes !== 1 ? "s" : ""}, ${seconds} point ${formattedMilliseconds}`;
    } else {
      return `${seconds} point ${formattedMilliseconds}`;
    }
  };

  const getBestLap = (laps: number[]) => {
    if (laps.length === 0) return null;
    const bestTime = Math.min(...laps);
    const bestLapIndex = laps.indexOf(bestTime);
    return { time: bestTime, lapNumber: bestLapIndex + 1 };
  };

  const getCurrentDriverCars = (): Car[] => {
    const driver = drivers.find((d) => d.id === selectedDriver);
    return driver?.cars || [];
  };

  // Helper function to calculate current lap time
  const getCurrentLapTime = (): number => {
    if (!isRunning || !startTime) return 0;

    // Get total elapsed time since start
    const totalElapsedTime = currentTime;

    // Calculate completed laps time with validation
    const completedLapsTime = laps.reduce((sum, lap) => {
      const lapTime = typeof lap === "object" ? lap.lapTime : lap;
      if (typeof lapTime !== "number" || isNaN(lapTime)) {
        logger.warn("Invalid lap time:", lap);
        return sum;
      }
      return sum + lapTime;
    }, 0);

    const currentLapTime = totalElapsedTime - completedLapsTime;

    // Ensure we return a valid number
    return isNaN(currentLapTime) ? 0 : currentLapTime;
  };

  // State for last three sessions
  const getLastThreeSessions = () => {
    // First filter out current session
    const filteredSessions = savedSessions.filter((session) => (currentSession ? session.id !== currentSession.id : true));

    // Sort by date, newest first
    const sortedSessions = filteredSessions.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });

    // Get only the first three
    return sortedSessions.slice(0, 3);
  };

  const getPresetDates = (preset: DatePreset) => {
    let from: Date;
    let to: Date;

    if (preset.days === 0) {
      // Handle "Today" option
      from = startOfDay(new Date());
      to = endOfDay(new Date());
    } else if (preset.days === "month") {
      to = new Date();
      from = new Date(to.getFullYear(), to.getMonth(), 1);
    } else if (preset.days === "year") {
      to = new Date();
      from = new Date(to.getFullYear(), 0, 1);
    } else {
      to = new Date();
      from = addDays(to, -preset.days);
    }

    return { from, to };
  };

  const handleAddCar = async () => {
    const trimmedName = addEditDialogState.entityName.trim();

    if (!selectedDriver) {
      alert("Please select a driver first");
      return;
    }

    if (!trimmedName || !isCarNameUniqueForDriver(trimmedName)) {
      return;
    }

    try {
      const response = await fetch("/api/data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "car",
          name: trimmedName,
          driverId: selectedDriver,
          defaultCarNumber: addEditDialogState.defaultCarNumber,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create car");
      }

      const { car } = await response.json();

      setDrivers((prevDrivers) =>
        prevDrivers.map((driver) => {
          if (driver.id === selectedDriver) {
            return {
              ...driver,
              cars: [...driver.cars, car],
            };
          }
          return driver;
        })
      );

      setSelectedCar(car.id);
    } catch (error) {
      logger.error("Error creating car:", error);
      alert("Failed to create car. Please try again.");
    }
  };

  const handleAddDriver = async () => {
    const trimmedName = addEditDialogState.entityName.trim();

    if (!trimmedName || !isDriverNameUnique(trimmedName)) {
      return;
    }

    try {
      const response = await fetch("/api/data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "driver",
          name: trimmedName,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create driver");
      }

      const { driver } = await response.json();
      setDrivers((prevDrivers) => [...prevDrivers, driver]);
      setSelectedDriver(driver.id);
    } catch (error) {
      logger.error("Error creating driver:", error);
      alert("Failed to create driver. Please try again.");
    }
  };

  const handleAddLocation = async () => {
    const trimmedName = addEditDialogState.entityName.trim();

    if (!trimmedName || !isLocationNameUnique(trimmedName)) {
      return;
    }

    try {
      const response = await fetch("/api/data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "location",
          name: trimmedName,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create location");
      }

      const { location } = await response.json();
      setLocations((prevLocations) => [...prevLocations, location]);
      setSelectedLocation(location.id);
    } catch (error) {
      logger.error("Error creating location:", error);
      alert("Failed to create location. Please try again.");
    }
  };

  const handleMotionDetected = useCallback(
    (changePercent: number) => {
      if (!isRunningRef.current) {
        startTimer_MD();
      } else if (isRunningRef.current) {
        recordLap_MD();
      }
    },
    [selectedDriver, selectedCar, startTime, currentTime, laps, currentSession, sessionStartTime, selectedLapCount, inputLapCount, showLapCountInput, startAnimation, lapAnimation, stopAnimation, penalties, penaltyAnimation, isMobile, timingMode, showMotionDetector, isMotionTimingActive]
  );

  const driversRef = useRef(drivers);
  // Sync with the ref whenever it changes
  useEffect(() => {
    driversRef.current = drivers;
  }, [drivers]);

  const locationsRef = useRef(locations);
  // Sync with the ref whenever it changes
  useEffect(() => {
    locationsRef.current = locations;
  }, [locations]);

  const handleSessionCompletion = async (completedLaps: number[]): Promise<void> => {
    setIsRunning(false);
    setStartTime(null);
    setCurrentTime(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    //const driver = drivers.find((d) => d.id === selectedDriverRef.current);
    const driver = driversRef.current.find((d) => d.id === selectedDriverRef.current);
    const car = driver?.cars.find((c) => c.id === selectedCarRef.current);
    if (!driver || !car) {
      return;
    }

    // Calculate total time
    const totalTime = completedLaps.reduce((sum, lap) => sum + lap, 0);

    // Calculate stats using the raw lap times
    const stats = calculateStats(completedLaps);
    stats.totalTime = totalTime;

    const sessionId = Date.now().toString();

    // Format laps with proper structure
    const formattedLaps = completedLaps.map((lapTime, index) => ({
      lapNumber: index + 1,
      lapTime: Math.round(lapTime || 0), // Ensure we have valid numbers
    }));

    const newSession: Partial<Session> = {
      id: sessionId,
      date: sessionStartTime ?? new Date().toISOString(),
      driverId: selectedDriverRef.current,
      driverName: driver.name,
      carId: selectedCarRef.current,
      carName: car.name,
      locationId: selectedLocationRef.current,
      locationName: locationsRef.current.find((l) => l.id === selectedLocationRef.current)?.name || "",
      laps: formattedLaps,
      penalties,
      totalLaps: selectedLapCount === "unlimited" ? completedLaps.length : selectedLapCount,
      stats,
    };

    try {
      const response = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drivers,
          sessions: [...savedSessions, newSession],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save session");
      }

      logCurrentSessionFinish();

      setCurrentSession(null);
      setPenalties([]);
      await loadSavedData();

      ledDevice.displayMessage("Session   Finished", "All laps complete!");
      flashEnd();
    } catch (error) {
      logger.error("Error saving session:", error);
      alert("Failed to save session. Please try again.");
    }
  };

  const handleStart = async () => {
    try {
      await handleStartCamera();
    } catch (err) {
      console.error("Start error:", err);
      throw err; // Re-throw for remote control error handling
    }
  };

  const handleStartCamera = async () => {
    try {
      if (motionControlRef.current) {
        await motionControlRef.current.start();
      }
    } catch (error) {
      logger.error("Failed to start camera:", error);
      throw error;
    }
  };

  const handleStopCamera = () => {
    // Call the stop method through the ref
    motionControlRef.current?.stop();
  };

  const isCarNameUniqueForDriver = (name: string): boolean => {
    const currentDriver = drivers.find((d) => d.id === selectedDriver);
    if (!currentDriver) return true;

    return !currentDriver.cars.some((car) => car.name.toLowerCase().trim() === name.toLowerCase().trim());
  };

  const isDriverNameUnique = (name: string): boolean => {
    return !drivers.some((driver) => driver.name.toLowerCase().trim() === name.toLowerCase().trim());
  };

  const isLocationNameUnique = (name: string): boolean => {
    return !locations.some((location) => location.name.toLowerCase().trim() === name.toLowerCase().trim());
  };

  // Add the date filter function
  const isWithinDateRange = (sessionDate: string | null): boolean => {
    // If no date range is selected, show all sessions
    if (!previousSessionsDateRange.from && !previousSessionsDateRange.to) return true;

    // If session date is null or invalid, don't show the session
    if (!sessionDate) return false;

    try {
      const date = parseISO(sessionDate);

      if (previousSessionsDateRange.from && !previousSessionsDateRange.to) {
        return isAfter(date, startOfDay(previousSessionsDateRange.from)) || format(date, "yyyy-MM-dd") === format(previousSessionsDateRange.from, "yyyy-MM-dd");
      }

      if (!previousSessionsDateRange.from && previousSessionsDateRange.to) {
        return isBefore(date, endOfDay(previousSessionsDateRange.to)) || format(date, "yyyy-MM-dd") === format(previousSessionsDateRange.to, "yyyy-MM-dd");
      }

      if (previousSessionsDateRange.from && previousSessionsDateRange.to) {
        return (
          (isAfter(date, startOfDay(previousSessionsDateRange.from)) || format(date, "yyyy-MM-dd") === format(previousSessionsDateRange.from, "yyyy-MM-dd")) &&
          (isBefore(date, endOfDay(previousSessionsDateRange.to)) || format(date, "yyyy-MM-dd") === format(previousSessionsDateRange.to, "yyyy-MM-dd"))
        );
      }

      return true;
    } catch (error) {
      logger.error("Error parsing date:", error);
      return false;
    }
  };

  const isWithinPreviousSessionsDateRange = (sessionDate: string | null): boolean => {
    // If no date range is selected, show all sessions
    if (!previousSessionsDateRange.from && !previousSessionsDateRange.to) return true;

    // If session date is null or invalid, don't show the session
    if (!sessionDate) return false;

    try {
      const date = parseISO(sessionDate);

      if (previousSessionsDateRange.from && !previousSessionsDateRange.to) {
        return isAfter(date, startOfDay(previousSessionsDateRange.from)) || format(date, "yyyy-MM-dd") === format(previousSessionsDateRange.from, "yyyy-MM-dd");
      }

      if (!previousSessionsDateRange.from && previousSessionsDateRange.to) {
        return isBefore(date, endOfDay(previousSessionsDateRange.to)) || format(date, "yyyy-MM-dd") === format(previousSessionsDateRange.to, "yyyy-MM-dd");
      }

      if (previousSessionsDateRange.from && previousSessionsDateRange.to) {
        return (
          (isAfter(date, startOfDay(previousSessionsDateRange.from)) || format(date, "yyyy-MM-dd") === format(previousSessionsDateRange.from, "yyyy-MM-dd")) &&
          (isBefore(date, endOfDay(previousSessionsDateRange.to)) || format(date, "yyyy-MM-dd") === format(previousSessionsDateRange.to, "yyyy-MM-dd"))
        );
      }

      return true;
    } catch (error) {
      logger.error("Error parsing date:", error);
      return false;
    }
  };

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
      logger.error("Error loading data:", error);
    }
  };

  const playBeep = ({ frequency = 440, duration = 200, volume = 0.5, type = "square" }: BeepOptions = {}): Promise<void> => {
    if (playBeepsRef.current) {
      return new Promise(async (resolve) => {
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
    if (playBeepsRef.current) {
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

  const playStartBeep = async (): Promise<void> => {
    if (playBeepsRef.current) {
      await playBeep({
        frequency: 440,
        duration: 300,
        volume: 0.5,
        type: "square",
      });
      // Small gap between beeps
      await new Promise((resolve) => setTimeout(resolve, 20));

      await playBeep({
        frequency: 440,
        duration: 200,
        volume: 0.5,
        type: "square",
      });
    }
  };

  // Add this near your other state variables in lap-timer.tsx
  const [pollingError, setPollingError] = useState<string | null>(null);

  // Update the polling function
  const pollForSessionRequests = useCallback(async () => {
    if (!remoteControlActive) return;

    try {
      const response = await fetch("/api/session-requests/next", {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        // Add cache control
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch requests: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setPollingError(null);

      if (data.request) {
        const request = data.request;

        // Set up the session configuration
        setSelectedDriver(request.driverId);
        setSelectedCar(request.carId);
        setSelectedLocation(request.locationId);
        setSelectedLapCount(request.numberOfLaps);
        setTimingMode("motion"); // Force motion timing mode

        try {
          // Mark request as in progress
          await fetch(`/api/session-requests/${request.id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "IN_PROGRESS" }),
          });

          // Start the session
          await handleStart();

          // Mark as completed
          await fetch(`/api/session-requests/${request.id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "COMPLETED" }),
          });

          // TODO: make announcements configurable in db settings
          await sayIt("Session request received");
        } catch (error) {
          logger.error("Session error:", error);
          await fetch(`/api/session-requests/${request.id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "FAILED" }),
          });
          throw error;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error during polling";
      logger.error("Error polling for requests:", error);
      setPollingError(errorMessage);
    }
  }, [remoteControlActive]);

  // Add effect for polling
  // In lap-timer.tsx
  useEffect(() => {
    if (remoteControlActive) {
      // Initial poll
      pollForSessionRequests();

      // Set up polling interval
      const interval = setInterval(() => {
        pollForSessionRequests();
      }, 5000);

      remoteControlIntervalRef.current = interval;
    } else {
      if (remoteControlIntervalRef.current) {
        clearInterval(remoteControlIntervalRef.current);
        remoteControlIntervalRef.current = undefined;
      }
    }

    // Cleanup on unmount
    return () => {
      if (remoteControlIntervalRef.current) {
        clearInterval(remoteControlIntervalRef.current);
        remoteControlIntervalRef.current = undefined;
      }
    };
  }, [remoteControlActive, pollForSessionRequests]);

  // Add this to your cleanup for components with useEffect
  useEffect(() => {
    return () => {
      if (remoteControlIntervalRef.current) {
        clearInterval(remoteControlIntervalRef.current);
      }
    };
  }, []);

  const recordLap = async (): Promise<void> => {
    if (!isRunning) return;

    setLapAnimation(true);
    setTimeout(() => setLapAnimation(false), 300);

    // Calculate the current lap time
    const lastLapEndTime = laps.reduce((sum, lap) => sum + lap, 0);
    const currentLapTime = currentTime - lastLapEndTime;

    // Add the new lap time as a number
    setLaps((prev) => [...prev, currentLapTime]);

    // Check if we've reached the selected number of laps
    if (selectedLapCount !== "unlimited" && laps.length + 1 >= selectedLapCount) {
      playRaceFinish();
      announceRaceInfo(lapsRef.current.length, currentLapTime, true);
      handleSessionCompletion([...laps, currentLapTime]);
    } else {
      playBeep();
      // Announce the lap information
      announceRaceInfo(laps.length + 2, currentLapTime);
    }

    logCurrentSessionRecordLap(lastLapEndTime, currentLapTime);

    //flashPresets.redFlash(1000);
    ledDevice.displayMessage(`Lap ${laps.length + 1}`, `${currentLapTime / 1000} seconds`);
    flashLap();
  };

  const recordLap_MD = async (): Promise<void> => {
    if (!isRunningRef.current) return;

    setLapAnimation(true);
    setTimeout(() => setLapAnimation(false), 300);

    // Calculate the current lap time
    const lastLapEndTime = lapsRef.current.reduce((sum, lap) => sum + lap, 0);
    const currentLapTime = currentTimeRef.current - lastLapEndTime;

    // Add the new lap time as a number
    setLaps((prev) => [...prev, currentLapTime]);

    // Check if we've reached the selected number of laps
    if (selectedLapCountRef.current !== "unlimited" && lapsRef.current.length + 1 >= selectedLapCountRef.current) {
      playRaceFinish();
      announceRaceInfo(lapsRef.current.length, currentLapTime, true);
      handleStopCamera();
      handleSessionCompletion([...lapsRef.current, currentLapTime]);
    } else {
      playBeep();
      // Announce the lap information
      announceRaceInfo(lapsRef.current.length + 2, currentLapTime);
    }

    logCurrentSessionRecordLap(lastLapEndTime, currentLapTime);

    //flashPresets.redFlash(1000);
    ledDevice.displayMessage(`Lap ${laps.length + 1}`, `${currentLapTime / 1000} seconds`);
    flashLap();
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

  // Save data function
  const saveData = async () => {
    try {
      const data: PersistentData = {
        sessions: savedSessions,
        drivers: drivers,
        lastUpdated: new Date().toISOString(),
      };

      const response = await fetch("/api/data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to save data");
    } catch (error) {
      logger.error("Error saving data:", error);
    }
  };

  const sortSessionsByDate = (sessions: Session[]): Session[] => {
    return [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const startTimer = async (): Promise<void> => {
    if (!selectedDriver || !selectedCar || !selectedLocation) {
      alert("Please select a driver and car before starting the timer");
      return;
    }

    playStartBeep();
    announceRaceBegin();
    setStartAnimation(true);
    setTimeout(() => setStartAnimation(false), 500);
    setStartTime(Date.now());
    setIsRunning(true);
    setLaps([]);
    logCurrentSessionStart();

    // flashPresets.greenFlash(1000);
    setLedGreen(100);
    ledDevice.displayMessage("Session    Start", `${drivers.find((d) => d.id === selectedDriver)?.name} - ${getCurrentDriverCars().find((c) => c.id === selectedCar)?.name} at ${locations.find((l) => l.id === selectedLocation)?.name}`);
  };

  const startTimer_MD = async (): Promise<void> => {
    if (!selectedDriverRef || !selectedCarRef || !selectedLocationRef) {
      alert("Please select a driver, car, and location before starting the timer");
      return;
    }

    playStartBeep();
    announceRaceBegin();
    setStartAnimation(true);
    setTimeout(() => setStartAnimation(false), 500);
    setStartTime(Date.now());
    setIsRunning(true);
    setLaps([]);
    logCurrentSessionStart();

    //flashPresets.greenFlash(1000);
    setLedGreen(100);
    ledDevice.displayMessage("Session    Start", `${drivers.find((d) => d.id === selectedDriver)?.name} - ${getCurrentDriverCars().find((c) => c.id === selectedCar)?.name} at ${locations.find((l) => l.id === selectedLocation)?.name}`);
  };

  const stopTimer = (): void => {
    if (!isRunning) return;
    playRaceFinish();
    handleStopCamera();
    setStopAnimation(true);
    setTimeout(() => setStopAnimation(false), 500);
    const finalLapTime = currentTime - (laps.length > 0 ? laps.reduce((a, b) => a + b, 0) : 0);
    const finalLaps = [...laps, finalLapTime];
    handleSessionCompletion(finalLaps);

    if (announceLapNumberRef.current) {
      sayIt("Timing session ended");
    }
  };

  const stopTimer_MD = (): void => {
    if (!isRunning) return;
    playRaceFinish();
    handleStopCamera();
    setStopAnimation(true);
    setTimeout(() => setStopAnimation(false), 500);
    const finalLaps = [...laps];
    handleSessionCompletion(finalLaps);

    if (announceLapNumberRef.current) {
      sayIt("Timing session ended");
    }
  };

  const validateLapCount = (value: string): boolean => {
    const num = parseInt(value, 10);
    return !isNaN(num) && num > 0 && num <= 999;
  };

  // ******************************************************************************************
  // ******************************************************************************************
  // *                               CURRENT SESSION RECORDING                                *
  // ******************************************************************************************
  // ******************************************************************************************

  const [theCurrentSessionId, setTheCurrentSessionId] = useState<string | null>(null);
  const theCurrentSessionIdRef = useRef(theCurrentSessionId);
  // Sync with the ref whenever it changes
  useEffect(() => {
    theCurrentSessionIdRef.current = theCurrentSessionId;
  }, [theCurrentSessionId]);

  const [theCurrentSessionPenaltyCount, setTheCurrentSessionPenaltyCount] = useState<number>(0);
  const [theCurrentSessionLapNumber, setTheCurrentSessionLapNumber] = useState<number>(0);

  const logCurrentSessionStart = async (): Promise<void> => {
    setTheCurrentSessionLapNumber(1);

    const displayDriverName = getDriverNameByIdSync(selectedDriver, drivers);
    const displayCarName = getCarNameByIdSync(selectedCar, drivers);
    const displayLocationName = getLocationNameByIdSync(selectedLocation, locations);

    var currentSessionLapCount = 0;
    if (selectedLapCount != "unlimited") {
      currentSessionLapCount = selectedLapCount;
    }

    // If db record exists, delete it
    try {
      await truncateCurrentSessions();
      // Handle successful truncate
    } catch (error) {
      // Handle error
      console.error("Failed to truncate current sessions:", error);
    }

    // Create db record
    const response = await createCurrentSession({
      driverName: displayDriverName || "",
      carName: displayCarName || "",
      locationName: displayLocationName || "",
      lapCount: currentSessionLapCount,
    });

    if (response.success) {
      // Store the current session ID for future lap additions
      const currentSessionId = response.session.id;
      setTheCurrentSessionId(currentSessionId);
    } else {
      throw new Error("Failed to create current session");
    }
  };

  const logCurrentSessionRecordLap = async (LastLapEndTime: number, CurrentLapTime: number): void => {
    // Type guard to ensure we have a valid session ID
    if (!theCurrentSessionIdRef.current) {
      logger.warn("No current session ID to record laps for");
      return;
    }

    // Add CurrentLapTime to db
    const response = await addLapToCurrentSession({
      sessionId: String(theCurrentSessionIdRef.current),
      lapTime: CurrentLapTime, // lap time in milliseconds
      lapNumber: theCurrentSessionLapNumber + 1,
      penaltyCount: theCurrentSessionPenaltyCount,
    });

    // Increment the lap counter
    setTheCurrentSessionLapNumber(theCurrentSessionLapNumber + 1);

    if (response.success) {
      setTheCurrentSessionPenaltyCount(0);
      return response.lap;
    } else {
      throw new Error("Failed to add lap");
    }
  };

  const logCurrentSessionAddPenalty = (CurrentLapNumber: number): void => {
    // Add penalty to current lap record using CurrentLapNumber
    setTheCurrentSessionPenaltyCount(theCurrentSessionPenaltyCount + 1);
  };

  const logCurrentSessionFinish = async (): Promise<void> => {
    // Type guard to ensure we have a valid session ID
    if (!theCurrentSessionIdRef.current) {
      logger.warn("No current session ID to delete");
      return;
    }

    // Delete db record
    const response = await deleteCurrentSession(theCurrentSessionIdRef.current);
  };

  function getDriverNameByIdSync(driverId: string, drivers: Driver[]): string | null {
    try {
      const driver = drivers.find((d) => d.id === driverId);
      return driver?.name ?? null;
    } catch (error) {
      logger.error("Error getting driver name from local data:", error);
      return null;
    }
  }

  function getCarNameByIdSync(carId: string, drivers: Driver[]): string | null {
    try {
      for (const driver of drivers) {
        const car = driver.cars.find((c) => c.id === carId);
        if (car) return car.name;
      }
      return null;
    } catch (error) {
      logger.error("Error getting car name from local data:", error);
      return null;
    }
  }

  function getLocationNameByIdSync(locationId: string, locations: Location[]): string | null {
    try {
      const location = locations.find((l) => l.id === locationId);
      return location?.name ?? null;
    } catch (error) {
      logger.error("Error getting location name from local data:", error);
      return null;
    }
  }

  // Create a new current session
  async function createCurrentSession(data: { driverName: string; carName: string; locationName: string; lapCount?: number }) {
    const response = await fetch("/api/current-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return await response.json();
  }

  // Add a new lap to current session
  async function addLapToCurrentSession(data: { sessionId: string; lapTime: number; lapNumber: number; penaltyCount?: number }) {
    const response = await fetch("/api/current-session", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "addLap", ...data }),
    });
    return await response.json();
  }

  // Delete a current session (and all its laps)
  async function deleteCurrentSession(sessionId: string) {
    const response = await fetch("/api/current-session", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    return await response.json();
  }

  // Deletes all records from the CurrentSession and CurrentLap tables
  async function truncateCurrentSessions(): Promise<boolean> {
    try {
      const response = await fetch("/api/current-session/truncate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to truncate current sessions");
      }

      if (data.success) {
        return true;
      } else {
        throw new Error("Truncate operation did not return success");
      }
    } catch (error) {
      logger.error("Error in truncateCurrentSessions:", error);
      throw error;
    }
  }

  // *****************************************************************************
  // *****************************************************************************
  // *                               LED CONTROLS                                *
  // *****************************************************************************
  // *****************************************************************************

  interface LedColor {
    red: number;
    green: number;
    blue: number;
  }

  const flashLed = async (color: LedColor, duration: number): Promise<void> => {
    try {
      // Turn on the LED with specified color
      await setLedColor(color);

      // Wait for the specified duration
      await new Promise((resolve) => setTimeout(resolve, duration));

      // Turn off the LED
      await setLedOff();
    } catch (error) {
      console.error("Error flashing LED:", error);
      throw error;
    }
  };

  const flashPresets = {
    redFlash: (duration: number) => flashLed({ red: 100, green: 0, blue: 0 }, duration),
    greenFlash: (duration: number) => flashLed({ red: 0, green: 100, blue: 0 }, duration),
    blueFlash: (duration: number) => flashLed({ red: 0, green: 0, blue: 100 }, duration),
    yellowFlash: (duration: number) => flashLed({ red: 100, green: 30, blue: 0 }, duration),
  };

  const setLedColor = async (color: LedColor): Promise<void> => {
    const { red, green, blue } = color;

    // Ensure values are between 0 and 100
    const validRed = Math.max(0, Math.min(100, red));
    const validGreen = Math.max(0, Math.min(100, green));
    const validBlue = Math.max(0, Math.min(100, blue));

    try {
      const response = await axios.get(`/api/ir/led/${validRed}/${validGreen}/${validBlue}`);

      const scaledRed = Math.round(2.55 * validRed);
      const scaledGreen = Math.round(2.55 * validGreen);
      const scaledBlue = Math.round(2.55 * validBlue);
      ledDevice.setColor(scaledRed, scaledGreen, scaledBlue);
    } catch (error) {
      console.error("Error setting LED color:", error);
      throw error;
    }
  };

  const setLedRed = async (level: number): Promise<void> => {
    try {
      const response = await axios.get(`/api/ir/led/${level}/0/0`);

      const scaledRed = Math.round(2.55 * level);
      ledDevice.setColor(scaledRed, 0, 0);
    } catch (error) {
      console.error("Error setting LED RED:", error);
      throw error;
    }
  };

  const setLedGreen = async (level: number): Promise<void> => {
    try {
      const response = await axios.get(`/api/ir/led/0/${level}/0`);

      const scaledGreen = Math.round(2.55 * level);
      ledDevice.setColor(0, scaledGreen, 0);
    } catch (error) {
      console.error("Error setting LED GREEN:", error);
      throw error;
    }
  };

  const setLedBlue = async (level: number): Promise<void> => {
    try {
      const response = await axios.get(`/api/ir/led/0/0/${level}`);

      const scaledBlue = Math.round(2.55 * level);
      ledDevice.setColor(0, 0, scaledBlue);
    } catch (error) {
      console.error("Error setting LED BLUE:", error);
      throw error;
    }
  };

  const setLedOff = async (): Promise<void> => {
    try {
      const response = await axios.get(`/api/ir/led/0/0/0`);

      ledDevice.setColor(0, 0, 0);
    } catch (error) {
      console.error("Error setting LED color:", error);
      throw error;
    }
  };

  const flashLap = async (): Promise<void> => {
    await flashPresets.redFlash(1000);
    setLedGreen(100);
  };

  const flashPenalty = async (): Promise<void> => {
    await flashPresets.yellowFlash(1000);
    setLedGreen(100);
  };

  const flashEnd = async (): Promise<void> => {
    await flashPresets.redFlash(500);
    await flashPresets.greenFlash(500);
    await flashPresets.redFlash(500);
    await flashPresets.greenFlash(500);
    await flashPresets.redFlash(500);
    await flashPresets.greenFlash(500);
    await setLedBlue(25);
  };

  // ************************************************************************************************************************************************************************************************************************************************
  // ************************************************************************************************************************************************************************************************************************************************
  // ************************************************************************************************************************************************************************************************************************************************
  // ************************************************************************************************************************************************************************************************************************************************
  // ************************************************************************************************************************************************************************************************************************************************


  const handleCarDetected = useCallback(
    (carId: string, timestamp: string) => {
      if (!isRunningRef.current) {
        startTimer_IR();
      } else if (isRunningRef.current) {
        recordLap_IR();
      }
    },
    [isRunningRef]
  );

  const startTimer_IR = async (): Promise<void> => {
    if (!selectedDriverRef.current || !selectedCarRef.current || !selectedLocationRef.current) {
      alert("Please select a driver and car before starting the timer");
      return;
    }

    playStartBeep();
    announceRaceBegin();

    setStartAnimation(true);
    setTimeout(() => setStartAnimation(false), 500);

    setStartTime(Date.now());
    setIsRunning(true);
    setLaps([]);
    logCurrentSessionStart();
    setLedGreen(100);

    const driverName = driversRef.current.find((d) => d.id === selectedDriverRef.current)?.name;

    //const carName = getCurrentDriverCars().find((c) => c.id === selectedCarRef.current)?.name;
    const carName = driversRef.current.find((d) => d.id === selectedDriverRef.current)?.cars.find((c) => c.id === selectedCarRef.current)?.name;

    //const locationName = locations.find((l) => l.id === selectedLocationRef.current)?.name;    
    const locationName = locationsRef.current.find((l) => l.id === selectedLocationRef.current)?.name;

    ledDevice.displayMessage("Session    Start", `${driverName} - ${carName} at ${locationName}`);
  };

  const recordLap_IR = () => {
    if (!isRunningRef.current) return;
    const lastLapEndTime = lapsRef.current.reduce((sum, lap) => sum + lap, 0);
    const currentLapTime = currentTimeRef.current - lastLapEndTime;
    setLaps((prev) => [...prev, currentLapTime]);
    if (selectedLapCountRef.current !== "unlimited" && lapsRef.current.length + 1 >= selectedLapCountRef.current) {
      playRaceFinish();
      announceRaceInfo(lapsRef.current.length, currentLapTime, true);
      handleSessionCompletion([...lapsRef.current, currentLapTime]);
    } else {
      playBeep();
      announceRaceInfo(lapsRef.current.length + 2, currentLapTime);
    }
    logCurrentSessionRecordLap(lastLapEndTime, currentLapTime);
    ledDevice.displayMessage(`Lap ${lapsRef.current.length + 1}`, `${currentLapTime / 1000} seconds`);
    flashLap();
  };

  const renderIRDetector = useCallback(() => {
    if (timingMode !== "ir") return null;

    return (
      <div className="flex flex-col gap-2">
        {isRunning && (
          <Button onClick={stopTimer} className="mt-4 w-full bg-red-500 hover:bg-red-600">
            <StopCircle className="mr-2 h-6 w-6" />
            Stop Timer
          </Button>
        )}
        <p>IR Detection Mode</p>
      </div>
    );
  }, [timingMode, selectedDriver, selectedCar, selectedLocation, isRunning, handleCarDetected]);

  // Run every 25 milliseconds
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const timerJob = () => {      
      if (timingMode == "ir") {
        const targetCarId = (getCurrentDriverCars().find((c) => c.id === selectedCarRef.current)?.defaultCarNumber || 0);
        fetchCarData(targetCarId.toString());
      }
      timeoutId = setTimeout(timerJob, 25);
    };
    
    timerJob(); // Start the first run

    // Cleanup function
    return () => clearTimeout(timeoutId);
  }, [timingMode, selectedDriver, selectedCar, selectedLocation, drivers]);

  // Clean up detected car numbers
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setCarCooldowns((prev) => {
        const updated = { ...prev };
        let hasChanges = false;
        Object.entries(updated).forEach(([carId, endTime]) => {
          if (endTime < now) {
            delete updated[carId];
            hasChanges = true;
          }
        });
        return hasChanges ? updated : prev;
      });
    }, 1000);

    return () => clearInterval(cleanupInterval);
  }, []);

  const [lastDetectedCars, setLastDetectedCars] = useState<CarDetection[]>([]);
  const [carCooldowns, setCarCooldowns] = useState<CooldownMap>({});
  const [cooldownPeriod] = useState(5000);
  const cooldownRef = useRef<CooldownMap>({});
  const previousCarsRef = useRef<Set<string>>(new Set());

  const startCooldown = useCallback(
    (carId: string) => {
      const newCooldowns = {
        ...cooldownRef.current,
        [carId]: Date.now() + cooldownPeriod,
      };
      cooldownRef.current = newCooldowns;
      setCarCooldowns(newCooldowns);
    },
    [cooldownPeriod]
  );

  const processNewDetections = useCallback(
    (cars: CarDetection[], targetCarIdValue: string) => {
      const currentCarIds = new Set(cars.map((car) => car.id));
      const previousCarIds = previousCarsRef.current;

      // Find newly detected cars
      cars.forEach((car) => {
        if (car.id == targetCarIdValue) {
          if (!previousCarIds.has(car.id)) {
            const cooldownEndTime = cooldownRef.current[car.id];
            if (!cooldownEndTime || Date.now() >= cooldownEndTime) {
              handleCarDetected(car.id, car.time);
              startCooldown(car.id);
            }
          }  
        }
      });

      previousCarsRef.current = currentCarIds;
      setLastDetectedCars(cars);
    },
    [handleCarDetected, startCooldown]
  );

  const fetchCarData = useCallback(async (targetCarIdValue: string) => {
    try {
      const response = await axios.get("/api/ir/current_cars");
      processNewDetections(response.data, targetCarIdValue);
    } catch (error) {
      console.error("Error fetching car data:", error);
    }
  }, [processNewDetections]);

  // ****************************************
  // return
  // ****************************************
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Practice</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="current" className="h-full" value={activeTab} onValueChange={setActiveTab}>
          {/* Navigation */}
          <TabsList className="grid w-full h-full grid-cols-5">
            {/* Current Session */}
            <TabsTrigger value="current" className="py-3">
              <div className="flex flex-col items-center">
                <CarIcon className="h-5 w-5" />
                <span className="text-xs mt-1">Current</span>
              </div>
            </TabsTrigger>

            {/* Previous Sessions */}
            <TabsTrigger value="previous" className="py-3">
              <div className="flex flex-col items-center">
                <ClipboardList className="h-5 w-5" />
                <span className="text-xs mt-1">
                  Session
                  <br /> Mgmt
                </span>
              </div>
            </TabsTrigger>

            {/* Best Laps Comparison */}
            <TabsTrigger value="best" className="py-3">
              <div className="flex flex-col items-center">
                <Trophy className="h-5 w-5" />
                <span className="text-xs mt-1">Best</span>
              </div>
            </TabsTrigger>

            {/* Session Comparison */}
            <TabsTrigger value="compare" className="py-3">
              <div className="flex flex-col items-center">
                <ChartArea className="h-5 w-5" />
                <span className="text-xs mt-1">Compare</span>
              </div>
            </TabsTrigger>

            {/* Session Notes */}
            <TabsTrigger value="notes" className="py-3">
              <div className="flex flex-col items-center">
                <NotebookPen className="h-5 w-5" />
                <span className="text-xs mt-1">Notes</span>
              </div>
            </TabsTrigger>
          </TabsList>

          {/* Current Session Tab */}
          <TabsContent value="current" className="px-4 space-y-4 h-full overflow-y-auto">
            <motion.div key={activeTab} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.3 }}>
              {/* Session Configuration Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Session Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Annoucements Selection */}
                  <div className="space-y-3 p-4 bg-gray-50 rounded">
                    <h3 className="font-semibold">Announcements</h3>
                    <div className="space-y-2">
                      {/* Annouce Lap Number */}
                      <div className="flex items-center space-x-2">
                        <input type="checkbox" id="announceLapNumber" checked={announceLapNumber} onChange={(e) => setAnnounceLapNumber(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                        <label htmlFor="announceLapNumber" className="text-sm">
                          Announce Lap Numbers
                        </label>
                      </div>

                      {/* Annouce Last Lap Time */}
                      <div className="flex items-center space-x-2">
                        <input type="checkbox" id="announceLastLapTime" checked={announceLastLapTime} onChange={(e) => setAnnounceLastLapTime(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                        <label htmlFor="announceLastLapTime" className="text-sm">
                          Announce Last Lap Time
                        </label>
                      </div>

                      {/* Play Beeps */}
                      <div className="flex items-center space-x-2">
                        <input type="checkbox" id="playBeeps" checked={playBeeps} onChange={(e) => setPlayBeeps(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                        <label htmlFor="announceLastLapTime" className="text-sm">
                          Play Beeps
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Remote Control Mode */}
                  <div className="flex items-center space-x-2 p-4 bg-gray-50 rounded-lg">
                    <input
                      type="checkbox"
                      id="remoteControl"
                      checked={remoteControlActive}
                      onChange={(e) => {
                        // Don't allow enabling remote control if a session is running
                        if (e.target.checked && isRunning) {
                          alert("Please end the current session before enabling remote control");
                          return;
                        }
                        setRemoteControlActive(e.target.checked);
                        setTimingMode("motion");
                      }}
                      disabled={isRunning}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <label htmlFor="remoteControl" className="text-sm font-medium">
                      Enable Remote Control Mode
                    </label>
                    {remoteControlActive && <div className="ml-2 text-sm text-gray-500">Polling for session requests...</div>}
                  </div>

                  {/* Driver Selection */}
                  <div className={`space-y-2 ${remoteControlActive ? "hidden" : ""}`}>
                    <Label>Driver</Label>
                    <div className="flex space-x-2">
                      <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select Driver" />
                        </SelectTrigger>
                        <SelectContent>
                          {drivers
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((driver) => (
                              <SelectItem key={driver.id} value={driver.id}>
                                {driver.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        onClick={() =>
                          setAddEditDialogState({
                            isOpen: true,
                            type: "driver",
                            action: "add",
                            entityName: "",
                          })
                        }
                      >
                        <User className="mr-2 h-4 w-4" />
                        New Driver
                      </Button>
                    </div>
                  </div>

                  {/* Car Selection */}
                  <div className={`space-y-2 ${remoteControlActive ? "hidden" : ""}`}>
                    {selectedDriver && (
                      <>
                        <Label>Car</Label>
                        <div className="flex space-x-2">
                          <Select value={selectedCar} onValueChange={setSelectedCar}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select Car" />
                            </SelectTrigger>
                            <SelectContent>
                              {getCurrentDriverCars()
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map((car) => (
                                  <SelectItem key={car.id} value={car.id}>
                                    {car.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            onClick={() =>
                              setAddEditDialogState({
                                isOpen: true,
                                type: "car",
                                action: "add",
                                entityName: "",
                              })
                            }
                          >
                            <CarIcon className="mr-2 h-4 w-4" />
                            New Car
                          </Button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Location Selection */}
                  <div className={`space-y-2 ${remoteControlActive ? "hidden" : ""}`}>
                    {selectedDriver && selectedCar && (
                      <>
                        <Label>Location</Label>
                        <div className="flex space-x-2">
                          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select Location" />
                            </SelectTrigger>
                            <SelectContent>
                              {locations
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map((location) => (
                                  <SelectItem key={location.id} value={location.id}>
                                    {location.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            onClick={() =>
                              setAddEditDialogState({
                                isOpen: true,
                                type: "location",
                                action: "add",
                                entityName: "",
                              })
                            }
                          >
                            <MapPin className="mr-2 h-4 w-4" />
                            New Location
                          </Button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Add/Edit Entity Dialog */}
                  <AlertDialog
                    open={addEditDialogState.isOpen}
                    onOpenChange={(open) => {
                      if (!open) {
                        setAddEditDialogState({
                          isOpen: false,
                          type: null,
                          action: null,
                          entityName: "",
                        });
                      }
                    }}
                  >
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Add New {addEditDialogState.type === "driver" ? "Driver" : addEditDialogState.type === "car" ? "Car" : "Location"}</AlertDialogTitle>
                        <AlertDialogDescription>Enter a name for the new {addEditDialogState.type}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="py-4">
                        <Input
                          value={addEditDialogState.entityName}
                          onChange={(e) =>
                            setAddEditDialogState((prev) => ({
                              ...prev,
                              entityName: e.target.value,
                            }))
                          }
                          placeholder={`Enter ${addEditDialogState.type} name`}
                          className={
                            addEditDialogState.entityName.trim() &&
                            ((addEditDialogState.type === "driver" && !isDriverNameUnique(addEditDialogState.entityName)) ||
                              (addEditDialogState.type === "car" && !isCarNameUniqueForDriver(addEditDialogState.entityName)) ||
                              (addEditDialogState.type === "location" && !isLocationNameUnique(addEditDialogState.entityName)))
                              ? "border-red-500"
                              : ""
                          }
                        />

                        {/* Default car number input for cars */}
                        {addEditDialogState.type === "car" && (
                          <div className="space-y-2">
                            <Label>Default IR Car Number (Optional)</Label>
                            <Input
                              type="number"
                              min="1"
                              max="8"
                              value={addEditDialogState.defaultCarNumber || ""}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === "" || (parseInt(value) >= 1 && parseInt(value) <= 8)) {
                                  setAddEditDialogState((prev) => ({
                                    ...prev,
                                    defaultCarNumber: value === "" ? undefined : parseInt(value),
                                  }));
                                }
                              }}
                              placeholder="Enter default car number (1-8)"
                            />
                          </div>
                        )}

                        {addEditDialogState.entityName.trim() &&
                          (addEditDialogState.type === "driver" && !isDriverNameUnique(addEditDialogState.entityName) ? (
                            <p className="text-sm text-red-500 mt-2">This driver name already exists</p>
                          ) : addEditDialogState.type === "car" && !isCarNameUniqueForDriver(addEditDialogState.entityName) ? (
                            <p className="text-sm text-red-500 mt-2">This car name already exists for this driver</p>
                          ) : addEditDialogState.type === "location" && !isLocationNameUnique(addEditDialogState.entityName) ? (
                            <p className="text-sm text-red-500 mt-2">This location name already exists</p>
                          ) : null)}
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            if (addEditDialogState.type === "driver") {
                              handleAddDriver();
                            } else if (addEditDialogState.type === "car") {
                              handleAddCar();
                            } else if (addEditDialogState.type === "location") {
                              handleAddLocation();
                            }
                            setAddEditDialogState({
                              isOpen: false,
                              type: null,
                              action: null,
                              entityName: "",
                            });
                          }}
                          disabled={
                            !addEditDialogState.entityName.trim() ||
                            (addEditDialogState.type === "driver" && !isDriverNameUnique(addEditDialogState.entityName)) ||
                            (addEditDialogState.type === "car" && !isCarNameUniqueForDriver(addEditDialogState.entityName)) ||
                            (addEditDialogState.type === "location" && !isLocationNameUnique(addEditDialogState.entityName))
                          }
                        >
                          Add
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  {/* Lap Count Selection */}
                  <div className={`space-y-2 ${remoteControlActive ? "hidden" : ""}`}>
                    {selectedDriver && selectedCar && (
                      <>
                        <Label>Number of Laps</Label>
                        <div className="flex space-x-2">
                          <Select
                            value={showLapCountInput ? "custom" : selectedLapCount.toString()}
                            onValueChange={(value) => {
                              if (value === "custom") {
                                setShowLapCountInput(true);
                                setInputLapCount("");
                              } else if (value === "unlimited") {
                                setShowLapCountInput(false);
                                setSelectedLapCount("unlimited");
                              } else {
                                setShowLapCountInput(false);
                                setSelectedLapCount(parseInt(value, 10));
                              }
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select number of laps" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unlimited">Unlimited</SelectItem>
                              <SelectItem value="3">3 Laps</SelectItem>
                              <SelectItem value="5">5 Laps</SelectItem>
                              <SelectItem value="10">10 Laps</SelectItem>
                              <SelectItem value="25">25 Laps</SelectItem>
                              <SelectItem value="custom">Custom...</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}

                    {showLapCountInput && (
                      <div className="flex space-x-2 mt-2">
                        <Input type="number" min="1" max="999" placeholder="Enter number of laps" value={inputLapCount} onChange={(e) => setInputLapCount(e.target.value)} />
                        <Button
                          onClick={() => {
                            if (validateLapCount(inputLapCount)) {
                              setSelectedLapCount(parseInt(inputLapCount, 10));
                              setShowLapCountInput(false);
                            } else {
                              alert("Please enter a valid number of laps (1-999)");
                            }
                          }}
                        >
                          Set
                        </Button>
                      </div>
                    )}

                    <div className="text-sm text-muted-foreground mt-1">{selectedLapCount === "unlimited" ? "Session will continue until manually stopped" : `Session will automatically complete after ${selectedLapCount} laps`}</div>
                  </div>

                  {/* Timing Mode Selection */}
                  <div className={`space-y-2 ${remoteControlActive ? "hidden" : ""}`}>
                    <Label>Timing Mode</Label>
                    <RadioGroup
                      value={timingMode}
                      onValueChange={(value) => {
                        const newMode = value as "ui" | "motion" | "ir";
                        // Handle other modes as before
                        setTimingMode(newMode);
                        if (newMode === "motion") {
                          setShowMotionDetector(true);
                          // Reset timer state when switching to motion mode
                          if (isRunning) {
                            stopTimer();
                          }
                        } else if (newMode === "ui") {
                          setShowMotionDetector(false);
                          setIsMotionTimingActive(false);
                        } else if (newMode === "ir") {
                          setShowMotionDetector(false);
                          setIsMotionTimingActive(false);
                        }
                      }}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="ui" id="timing-ui" />
                        <Label htmlFor="timing-ui" className="flex items-center">
                          <PlayCircle className="mr-2 h-4 w-4" />
                          Time Using UI
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="motion" id="timing-motion" />
                        <Label htmlFor="timing-motion" className="flex items-center">
                          <Video className="mr-2 h-4 w-4" />
                          Time Using Motion Detection
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="ir" id="timing-ir" />
                        <Label htmlFor="timing-ir" className="flex items-center">
                          <PlayCircle className="mr-2 h-4 w-4" />
                          Time Using IR
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Session Settings Summary */}
                  {selectedDriver && selectedCar && selectedLocation && selectedLapCount && (
                    <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                      <h3 className="font-semibold mb-2">Session Settings</h3>
                      <div className="space-y-1 text-sm">
                        <div>Driver: {drivers.find((d) => d.id === selectedDriver)?.name}</div>
                        <div>Car: {getCurrentDriverCars().find((c) => c.id === selectedCar)?.name}</div>
                        <div>Location: {locations.find((l) => l.id === selectedLocation)?.name}</div>
                        <div>Laps: {selectedLapCount === "unlimited" ? "Unlimited" : selectedLapCount}</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Timer Display */}
              <Card>
                <CardHeader>
                  <CardTitle className={cn("text-center text-5xl font-mono transition-all", isRunning && "animate-time-pulse")}>{formatTime(currentTime)}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Current Lap Time */}
                  <div className="text-center text-2xl font-mono text-gray-600">Current Lap: {formatTime(getCurrentLapTime())}</div>

                  {/* Lap counter */}
                  <div className="text-xl font-mono text-center">
                    {isRunning ? (selectedLapCount !== "unlimited" ? (laps.length >= selectedLapCount ? "Timing Session Finished" : `Lap: ${laps.length + 1} of ${selectedLapCount}`) : `Lap: ${laps.length + 1}`) : laps.length > 0 ? "Timing Session Finished" : "Ready"}
                  </div>

                  {/* Timer controls */}
                  {timingMode === "ui" && (
                    <div className="flex flex-col gap-2">
                      <Button onClick={startTimer} disabled={isRunning || !selectedDriver || !selectedCar} className={cn("bg-green-500 hover:bg-green-600 transition-all", startAnimation && "animate-timer-start")}>
                        <PlayCircle className="mr-2 h-6 w-6" />
                        Start Lap Timer
                      </Button>

                      <Button onClick={recordLap} disabled={!isRunning} className={cn("bg-blue-500 hover:bg-blue-600 transition-all", lapAnimation && "animate-lap-record")}>
                        <ListPlus className="mr-2 h-6 w-6" />
                        Record Lap
                      </Button>

                      <Button onClick={stopTimer} disabled={!isRunning} className={cn("bg-red-500 hover:bg-red-600 transition-all", stopAnimation && "animate-timer-stop")}>
                        <StopCircle className="mr-2 h-6 w-6" />
                        Stop Lap Timer
                      </Button>

                      <Button onClick={addPenalty} disabled={!isRunning} className={cn("bg-yellow-500 hover:bg-yellow-600 transition-all", penaltyAnimation && "animate-penalty-add")}>
                        <AlertTriangle className="mr-2 h-6 w-6" />
                        Add Penalty
                      </Button>
                    </div>
                  )}

                  {/* Motion Detector */}
                  {timingMode === "motion" && (
                    <div className="flex flex-col gap-2">
                      {isRunning && (
                        <Button onClick={stopTimer_MD} className="mt-4 w-full bg-red-500 hover:bg-red-600">
                          <StopCircle className="mr-2 h-6 w-6" />
                          Stop Timer
                        </Button>
                      )}

                      <MotionDetector
                        controlRef={motionControlRef}
                        onMotionDetected={(changePercent) => {
                          handleMotionDetected(changePercent);
                        }}
                        playBeeps={playBeepsRef.current}
                        className="w-full"
                      />
                    </div>
                  )}

                  {/* IR Detector */}
                  {timingMode === "ir" && renderIRDetector()}
                </CardContent>
              </Card>

              {/* Current Session - Only show if there's an active session */}
              {isRunning && laps.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Current Session</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h3 className="font-semibold">Session Info:</h3>
                          <div className="font-mono">Driver: {drivers.find((d) => d.id === selectedDriver)?.name}</div>
                          <div className="font-mono">Car: {getCurrentDriverCars().find((c) => c.id === selectedCar)?.name}</div>
                          <div className="font-mono">Location: {locations.find((l) => l.id === selectedLocation)?.name}</div>
                          <h3 className="font-semibold mt-4">Lap Times:</h3>

                          {/* Current Session lap times */}
                          {laps.map((lap, index) => {
                            const lapNumber = index + 1;
                            const lapPenalties = penalties.find((p) => p.lapNumber === lapNumber)?.count || 0;
                            const bestLap = getBestLap(laps);
                            const isBestLap = bestLap && index === bestLap.lapNumber - 1;
                            return (
                              <div key={index} className={`font-mono ${isBestLap ? "text-green-600 font-bold flex items-center" : ""}`}>
                                Lap {lapNumber}: {formatTime(lap)}
                                {isBestLap && <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Best Lap</span>}
                                {lapPenalties > 0 && (
                                  <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                                    {lapPenalties} {lapPenalties === 1 ? "Penalty" : "Penalties"}
                                  </span>
                                )}{" "}
                              </div>
                            );
                          })}
                        </div>

                        {/* Current Session statistics */}
                        <div>
                          <h3 className="font-semibold">Statistics:</h3>
                          <div className="font-mono">Average: {formatTime(calculateStats(laps).average)}</div>

                          {/* <div className="font-mono">Mean: {formatTime(calculateStats(laps).mean)}</div> */}

                          {laps.length > 0 && (
                            <>
                              <div className="font-mono text-green-600 font-bold mt-2">Best Lap: {formatTime(Math.min(...laps))}</div>
                              <div className="font-mono">Total Penalties: {penalties.reduce((sum, p) => sum + p.count, 0)}</div>
                              <div className="font-mono mt-2">Total Time: {formatTime(calculateStats(laps).totalTime)}</div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Last Three Sessions */}
              {getLastThreeSessions().length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Sessions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Display last three sessions using your existing session display code */}
                    {getLastThreeSessions().map((session) => (
                      <div key={session.id} className="border-t pt-4 first:border-t-0 first:pt-0">
                        {/* ... session header ... */}
                        <div className="flex justify-between items-center mb-2">
                          <div>
                            <h3 className="font-semibold">{formatDateTime(session.date)}</h3>
                            <div className="text-sm text-muted-foreground">
                              Driver: {session.driverName} - Car: {session.carName} - Location: {session.locationName}
                            </div>
                          </div>
                          <Button onClick={() => setSessionToDelete(session)} variant="destructive" size="sm" className="bg-red-500 hover:bg-red-600">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Lap Times Section */}
                          <div>
                            <h4 className="font-semibold mb-2">Lap Times:</h4>
                            {/* Sort laps by lap number before displaying */}
                            {[...session.laps]
                              .sort((a, b) => a.lapNumber - b.lapNumber)
                              .map((lap) => {
                                const bestLap = Math.min(...session.laps.map((l) => l.lapTime));
                                const worstLap = Math.max(...session.laps.map((l) => l.lapTime));
                                const isBestLap = lap.lapTime === bestLap;
                                const isWorstLap = lap.lapTime === worstLap;
                                const lapPenalties = session.penalties?.find((p) => p.lapNumber === lap.lapNumber)?.count || 0;
                                // Safely check for max penalties
                                const hasMaxPenalties = Boolean(session.stats?.maxPenaltyLap === lap.lapNumber && session.stats.maxPenaltyCount > 0);

                                return (
                                  <div key={lap.lapNumber} className={cn("font-mono flex items-center", isBestLap ? "text-green-600 font-bold" : "", isWorstLap ? "text-red-600 font-bold" : "", hasMaxPenalties ? "bg-yellow-50" : "")}>
                                    <span className="min-w-[100px]">
                                      Lap {lap.lapNumber}: {formatTime(lap.lapTime)}
                                    </span>

                                    {/* Flags row - will wrap on mobile */}
                                    {(isBestLap || isWorstLap || lapPenalties > 0 || hasMaxPenalties) && (
                                      <div className="flex flex-wrap gap-1 mt-1 ml-4">
                                        {/* Best Lap */}
                                        {isBestLap && (
                                          <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                            <Zap className="h-3 w-3 mr-1" />
                                          </span>
                                        )}
                                        {/* Slowest Lap */}
                                        {isWorstLap && (
                                          <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                                            <Turtle className="h-3 w-3 mr-1" />
                                          </span>
                                        )}
                                        {lapPenalties > 0 && (
                                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                                            {lapPenalties} {lapPenalties === 1 ? "Penalty" : "Penalties"}
                                          </span>
                                        )}
                                        {/* Most Penalties Lap */}
                                        {hasMaxPenalties && (
                                          <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full">
                                            <AlertTriangle className="h-3 w-3 mr-1" />
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    {/* Add divider between laps */}
                                    <div className="my-2" />
                                  </div>
                                );
                              })}
                          </div>

                          {/* Statistics Section */}
                          <div className="border-t md:border-t-0 pt-4 md:pt-0 mt-4 md:mt-0">
                            <h4 className="font-semibold mb-2">Statistics:</h4>
                            <div className="space-y-2">
                              {session.stats && (
                                <>
                                  <div className="font-mono">Average: {formatTime(session.stats.average)}</div>
                                  <div className="space-y-1 mt-2">
                                    {typeof session.stats.bestLap === "number" && <div className="font-mono text-green-600 font-bold">Best Lap: {formatTime(session.stats.bestLap)}</div>}
                                    {typeof session.stats.worstLap === "number" && <div className="font-mono text-red-600 font-bold">Slowest Lap: {formatTime(session.stats.worstLap)}</div>}
                                    <div className="font-mono mt-2">Total Penalties: {session.stats.totalPenalties || 0}</div>
                                  </div>
                                  <div className="font-mono mt-2">Total Time: {formatTime(session.stats.totalTime)}</div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </TabsContent>

          {/* Previous Sessions Tab */}
          <TabsContent value="previous" className="px-4 space-y-4 h-full overflow-y-auto">
            <motion.div key={activeTab} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.3 }}>
              {savedSessions.length === 0 ? (
                <>
                  {/* Current Session Display */}
                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle>Current Session</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {/* Current Session Display */}
                      <CurrentSessionDisplay />
                    </CardContent>

                    {/* Request Session Form */}
                    <Card>
                      <CardHeader>
                        <div className="flex justify-between items-center">
                          <CardTitle>Request a Session</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {/* Session Request Form */}
                        <SessionRequestForm drivers={drivers} locations={locations} />
                      </CardContent>
                    </Card>
                  </Card>

                  {/* No Records to Display Message */}
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center py-12">
                        <ListX className="mx-auto h-12 w-12 text-muted-foreground/50" />
                        <h3 className="mt-4 text-lg font-semibold">No Sessions Recorded</h3>
                        <p className="mt-2 text-sm text-muted-foreground">Record your first timing session to see it appear here.</p>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <>
                  {/* Current Session Display */}
                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle>Current Session</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {/* Current Session Display */}
                      <CurrentSessionDisplay />
                    </CardContent>
                  </Card>

                  {/* Request Session Form */}
                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle>Request a Session</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {/* Session Request Form */}
                      <SessionRequestForm drivers={drivers} locations={locations} />
                    </CardContent>
                  </Card>

                  {/* Previous Sessions Display */}
                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle>Previous Sessions</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {/* Driver and Car Filters */}
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="space-y-2">
                          <Label>Filter by Driver</Label>
                          <Select
                            value={filterDriver}
                            onValueChange={(value) => {
                              setFilterDriver(value);
                              setFilterCar("all"); // Reset car filter when driver changes
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="All Drivers" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Drivers</SelectItem>
                              {/* Get unique drivers from sessions */}
                              {Array.from(new Set(savedSessions.map((session) => session.driverName)))
                                .filter((name) => name && name.trim() !== "")
                                .sort((a, b) => a.localeCompare(b))
                                .map((driver) => (
                                  <SelectItem key={driver} value={driver}>
                                    {driver}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Filter by Car</Label>
                          <Select value={filterCar} onValueChange={setFilterCar} disabled={filterDriver === "all"}>
                            <SelectTrigger disabled={filterDriver === "all"}>
                              <SelectValue placeholder={filterDriver === "all" ? "Select a driver first" : "All Cars"} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Cars</SelectItem>
                              {filterDriver !== "all" &&
                                Array.from(new Set(savedSessions.filter((session) => session.driverName === filterDriver).map((session) => session.carName)))
                                  .filter((name) => name && name.trim() !== "")
                                  .sort((a, b) => a.localeCompare(b))
                                  .map((car) => (
                                    <SelectItem key={car} value={car}>
                                      {car}
                                    </SelectItem>
                                  ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Filter by Location</Label>
                          <Select
                            value={filterLocation}
                            onValueChange={(value) => {
                              setFilterLocation(value);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="All Locations" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Locations</SelectItem>
                              {/* Get unique locations from sessions */}
                              {Array.from(new Set(savedSessions.map((session) => session.locationName)))
                                .filter((name) => name && name.trim() !== "")
                                .sort((a, b) => a.localeCompare(b))
                                .map((location) => (
                                  <SelectItem key={location} value={location}>
                                    {location}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Date Range Filter */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label>Filter by Date Range</Label>
                        </div>

                        {/* Preset Buttons */}
                        <div className="flex flex-wrap gap-2 mb-4">
                          {DATE_PRESETS.map((preset) => {
                            const presetDates = getPresetDates(preset);
                            const isActive =
                              previousSessionsDateRange.from && previousSessionsDateRange.to && format(previousSessionsDateRange.from, "yyyy-MM-dd") === format(presetDates.from, "yyyy-MM-dd") && format(previousSessionsDateRange.to, "yyyy-MM-dd") === format(presetDates.to, "yyyy-MM-dd");

                            return (
                              <Button
                                key={preset.label}
                                variant="outline"
                                size="sm"
                                className={cn("hover:bg-muted", isActive ? "bg-primary text-primary-foreground hover:bg-primary/90" : "")}
                                onClick={() => {
                                  const { from, to } = getPresetDates(preset);
                                  setPreviousSessionsDateRange({ from, to });
                                }}
                              >
                                {preset.label}
                              </Button>
                            );
                          })}
                        </div>

                        {/* Custom Date Range Selectors */}
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className={cn("w-full sm:w-[240px] justify-start text-left font-normal", !previousSessionsDateRange.from && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {previousSessionsDateRange.from ? format(previousSessionsDateRange.from, "PPP") : "Select start date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={previousSessionsDateRange.from}
                                onSelect={(date) =>
                                  setPreviousSessionsDateRange((prev) => ({
                                    ...prev,
                                    from: date,
                                  }))
                                }
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>

                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className={cn("w-full sm:w-[240px] justify-start text-left font-normal", !previousSessionsDateRange.to && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {previousSessionsDateRange.to ? format(previousSessionsDateRange.to, "PPP") : "Select end date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={previousSessionsDateRange.to}
                                onSelect={(date) =>
                                  setPreviousSessionsDateRange((prev) => ({
                                    ...prev,
                                    to: date,
                                  }))
                                }
                                disabled={(date) => (previousSessionsDateRange.from ? isBefore(date, previousSessionsDateRange.from) : false)}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>

                          <Button
                            variant="outline"
                            onClick={() =>
                              setPreviousSessionsDateRange({
                                from: undefined,
                                to: undefined,
                              })
                            }
                            className="w-full sm:w-auto"
                          >
                            Reset Dates
                          </Button>
                        </div>

                        {/* Date Range Summary */}
                        {(previousSessionsDateRange.from || previousSessionsDateRange.to) && (
                          <div className="text-sm text-muted-foreground">
                            {previousSessionsDateRange.from &&
                            previousSessionsDateRange.to &&
                            format(previousSessionsDateRange.from, "yyyy-MM-dd") === format(startOfDay(new Date()), "yyyy-MM-dd") &&
                            format(previousSessionsDateRange.to, "yyyy-MM-dd") === format(endOfDay(new Date()), "yyyy-MM-dd") ? (
                              "Showing sessions from today"
                            ) : (
                              <>
                                Showing sessions
                                {previousSessionsDateRange.from && !previousSessionsDateRange.to && ` from ${format(previousSessionsDateRange.from, "PPP")}`}
                                {!previousSessionsDateRange.from && previousSessionsDateRange.to && ` until ${format(previousSessionsDateRange.to, "PPP")}`}
                                {previousSessionsDateRange.from && previousSessionsDateRange.to && ` from ${format(previousSessionsDateRange.from, "PPP")} to ${format(previousSessionsDateRange.to, "PPP")}`}
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Sessions List */}
                      <div className="space-y-6">
                        {sortSessionsByDate(
                          savedSessions
                            .filter((session) => (currentSession ? session.id !== currentSession.id : true))
                            .filter((session) => isWithinPreviousSessionsDateRange(session.date))
                            .filter((session) => filterDriver === "all" || session.driverName === filterDriver)
                            .filter((session) => filterCar === "all" || session.carName === filterCar)
                            .filter((session) => filterLocation === "all" || session.locationName === filterLocation)
                        ).map((session) => (
                          <div key={session.id} className="border-t pt-4 first:border-t-0 first:pt-0">
                            <div className="flex justify-between items-center mb-2">
                              <div>
                                <h3 className="font-semibold">{formatDateTime(session.date)}</h3>
                                <div className="text-sm text-muted-foreground">
                                  Driver: {session.driverName} - Car: {session.carName} - Location: {session.locationName}
                                </div>
                              </div>
                              <Button onClick={() => setSessionToDelete(session)} variant="destructive" size="sm" className="bg-red-500 hover:bg-red-600">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Lap Times Section */}
                              <div>
                                <h4 className="font-semibold mb-2">Lap Times:</h4>
                                {/* Sort laps by lap number before displaying */}
                                {[...session.laps]
                                  .sort((a, b) => a.lapNumber - b.lapNumber)
                                  .map((lap) => {
                                    const bestLap = Math.min(...session.laps.map((l) => l.lapTime));
                                    const worstLap = Math.max(...session.laps.map((l) => l.lapTime));
                                    const isBestLap = lap.lapTime === bestLap;
                                    const isWorstLap = lap.lapTime === worstLap;
                                    const lapPenalties = session.penalties?.find((p) => p.lapNumber === lap.lapNumber)?.count || 0;
                                    // Safely check for max penalties
                                    const hasMaxPenalties = Boolean(session.stats?.maxPenaltyLap === lap.lapNumber && session.stats.maxPenaltyCount > 0);

                                    return (
                                      <div key={lap.lapNumber} className={cn("font-mono flex items-center", isBestLap ? "text-green-600 font-bold" : "", isWorstLap ? "text-red-600 font-bold" : "")}>
                                        <span className="min-w-[100px]">
                                          Lap {lap.lapNumber}: {formatTime(lap.lapTime)}
                                        </span>

                                        {/* Flags row - will wrap on mobile */}
                                        {(isBestLap || isWorstLap || lapPenalties > 0 || hasMaxPenalties) && (
                                          <div className="flex flex-wrap gap-1 mt-1 ml-4">
                                            {/* Best Lap */}
                                            {isBestLap && (
                                              <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                                <Zap className="h-3 w-3 mr-1" />
                                              </span>
                                            )}
                                            {/* Slowest Lap */}
                                            {isWorstLap && (
                                              <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                                                <Turtle className="h-3 w-3 mr-1" />
                                              </span>
                                            )}
                                            {lapPenalties > 0 && (
                                              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                                                {lapPenalties} {lapPenalties === 1 ? "Penalty" : "Penalties"}
                                              </span>
                                            )}
                                            {/* Most Penalties Lap */}
                                            {hasMaxPenalties && (
                                              <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full">
                                                <AlertTriangle className="h-3 w-3 mr-1" />
                                              </span>
                                            )}
                                          </div>
                                        )}

                                        {/* Add divider between laps */}
                                        <div className="my-2" />
                                      </div>
                                    );
                                  })}
                              </div>

                              {/* Statistics Section */}
                              <div className="border-t md:border-t-0 pt-4 md:pt-0 mt-4 md:mt-0">
                                <h4 className="font-semibold mb-2">Statistics:</h4>
                                <div className="space-y-2">
                                  {session.stats && (
                                    <>
                                      <div className="font-mono">Average: {formatTime(session.stats.average)}</div>
                                      <div className="space-y-1 mt-2">
                                        {typeof session.stats.bestLap === "number" && <div className="font-mono text-green-600 font-bold">Best Lap: {formatTime(session.stats.bestLap)}</div>}
                                        {typeof session.stats.worstLap === "number" && <div className="font-mono text-red-600 font-bold">Slowest Lap: {formatTime(session.stats.worstLap)}</div>}
                                        <div className="font-mono mt-2">Total Penalties: {session.stats.totalPenalties || 0}</div>
                                      </div>
                                      <div className="font-mono mt-2">Total Time: {formatTime(session.stats.totalTime)}</div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {savedSessions.filter((session) => isWithinDateRange(session.date)).length === 0 && <div className="text-center py-8 text-muted-foreground">No sessions found for the selected date range.</div>}
                    </CardContent>
                  </Card>
                </>
              )}
            </motion.div>
          </TabsContent>

          {/* Best Laps Comparison Tab */}
          <TabsContent value="best" className="px-4 space-y-4 h-full overflow-y-auto">
            <motion.div key={activeTab} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.3 }}>
              {Array.isArray(savedSessions) && <BestLapsComparison sessions={savedSessions} />}
            </motion.div>
          </TabsContent>

          {/* Session Comparison Tab */}
          <TabsContent value="compare" className="px-4 space-y-4 h-full overflow-y-auto">
            <motion.div key={activeTab} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.3 }}>
              {Array.isArray(savedSessions) && <SessionComparison sessions={savedSessions} />}
            </motion.div>
          </TabsContent>

          {/* Session Notes Tab */}
          <TabsContent value="notes" className="px-4 space-y-4 h-full overflow-y-auto">
            <motion.div key={activeTab} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.3 }}>
              <SessionNotes sessions={savedSessions} />
            </motion.div>
          </TabsContent>
        </Tabs>

        {/* Delete Session Dialog */}
        <AlertDialog open={!!sessionToDelete} onOpenChange={() => setSessionToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Session</AlertDialogTitle>
              <AlertDialogDescription>Are you sure you want to delete the session from {sessionToDelete?.date}? If you delete this session, it's gone for good. So make sure this is what you really want to do!!</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction disabled={isDeleting} onClick={() => sessionToDelete && deleteSession(sessionToDelete.id)} className="bg-red-500 hover:bg-red-600">
                {isDeleting ? (
                  <div className="flex items-center">
                    <span className="animate-spin mr-2">â³</span>
                    Deleting...
                  </div>
                ) : (
                  "Delete"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
