"use client";

import { formatTime, formatDateTime } from "@/lib/utils";
import { SessionComparison } from "./session-comparison";
import { SessionNotes } from "./session-notes";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, ListX, Search, ListChecks, Trophy, BarChart2, AlertTriangle, PlayCircle, StopCircle, ListPlus, Trash2, User, Car as CarIcon, Turtle, Zap, Camera } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addDays, format, isBefore, isAfter, startOfDay, endOfDay, parseISO } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import cn from "classnames";
import { BestLapsComparison } from "./best-laps-comparison";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion"; // Added Framer Motion import
import { Driver, Car, Session, LapStats, PenaltyData } from "@/types/rc-timer";
import { MotionDetector } from "./motion-detector";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { is } from "date-fns/locale";

interface BeepOptions {
  frequency?: number; // Frequency in Hz
  duration?: number; // Duration in milliseconds
  volume?: number; // Volume between 0 and 1
  type?: OscillatorType; // Type of wave
}

class AudioContextManager {
  private static instance: AudioContext | null = null;

  static getInstance(): AudioContext {
    if (!this.instance) {
      this.instance = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.instance;
  }
}

export default function LapTimer() {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [laps, setLaps] = useState<number[]>([]);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [showClearAllDialog, setShowClearAllDialog] = useState<boolean>(false);
  const [newDriverName, setNewDriverName] = useState<string>("");
  const [newCarName, setNewCarName] = useState<string>("");
  const [showNewDriver, setShowNewDriver] = useState<boolean>(false);
  const [showNewCar, setShowNewCar] = useState<boolean>(false);
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
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string>("");
  const [selectedCar, setSelectedCar] = useState<string>("");
  const [savedSessions, setSavedSessions] = useState<Session[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timer | null>(null);
  const [timingMode, setTimingMode] = useState<TimingMode>("ui");
  const [showMotionDetector, setShowMotionDetector] = useState(false);
  const [isMotionTimingActive, setIsMotionTimingActive] = useState(false);

  const motionControlRef = useRef<{ stop: () => void }>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
      console.error("Error loading saved data:", error);
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

  useEffect(() => {
    setSelectedCar("");
  }, [selectedDriver]);

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

  interface DatePreset {
    label: string;
    days: number | "month" | "year";
  }

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
    setPenalties((prev) => {
      const existingPenalty = prev.find((p) => p.lapNumber === currentLapNumber);
      if (existingPenalty) {
        return prev.map((p) => (p.lapNumber === currentLapNumber ? { ...p, count: p.count + 1 } : p));
      }
      return [...prev, { lapNumber: currentLapNumber, count: 1 }];
    });
  };

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

    // Calculate total penalties
    const totalPenalties = session.penalties?.reduce((sum: number, penalty: any) => sum + (penalty.count || 0), 0) || 0;

    // Find the lap with most penalties
    let maxPenaltyLap = null;
    let maxPenaltyCount = 0;

    session.penalties?.forEach((penalty: any) => {
      if (penalty.count > maxPenaltyCount) {
        maxPenaltyCount = penalty.count;
        maxPenaltyLap = penalty.lapNumber;
      }
    });

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
        console.error("Delete response error:", errorData); // Debug log
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
      console.error("Error deleting session:", error);
      alert("Failed to delete session. Please try again.");
    } finally {
      setIsDeleting(false);
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
        console.warn("Invalid lap time:", lap);
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
    const trimmedName = newCarName.trim();

    if (!selectedDriver) {
      alert("Please select a driver first");
      return;
    }

    if (!trimmedName) {
      alert("Please enter a car name");
      return;
    }

    const currentDriver = drivers.find((d) => d.id === selectedDriver);
    if (!isCarNameUniqueForDriver(trimmedName)) {
      alert(`${currentDriver?.name} already has a car named "${trimmedName}". Please use a different name.`);
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
      setNewCarName("");
      setShowNewCar(false);
    } catch (error) {
      console.error("Error creating car:", error);
      alert("Failed to create car. Please try again.");
    }
  };

  const handleAddDriver = async () => {
    const trimmedName = newDriverName.trim();

    if (!trimmedName) {
      alert("Please enter a driver name");
      return;
    }

    if (!isDriverNameUnique(trimmedName)) {
      alert(`A driver named "${trimmedName}" already exists. Please use a different name.`);
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
      setNewDriverName("");
      setShowNewDriver(false);
      setSelectedCar("");
    } catch (error) {
      console.error("Error creating driver:", error);
      alert("Failed to create driver. Please try again.");
    }
  };

  const handleCarNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setNewCarName(newName);
  };

  const handleDriverNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setNewDriverName(newName);
  };

  const handleSessionCompletion = async (completedLaps: number[]): Promise<void> => {
    setIsRunning(false);
    setStartTime(null);
    setCurrentTime(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    const driver = drivers.find((d) => d.id === selectedDriverRef.current);
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
      driverId: selectedDriver,
      driverName: driver.name,
      carId: selectedCar,
      carName: car.name,
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

      setCurrentSession(null);
      setPenalties([]);
      await loadSavedData();
    } catch (error) {
      console.error("Error saving session:", error);
      alert("Failed to save session. Please try again.");
    }
  };

  // Function to stop the camera
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
      console.error("Error parsing date:", error);
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
      console.error("Error parsing date:", error);
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
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const playBeep = ({ frequency = 440, duration = 200, volume = 0.5, type = "square" }: BeepOptions = {}): Promise<void> => {
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
  };

  const playRaceFinish = async (): Promise<void> => {
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
  };

  const playStartBeep = async (): Promise<void> => {
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
  };

  const recordLap = (): void => {
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

      handleSessionCompletion([...laps, currentLapTime]);
    } else {
      playBeep();
    }
  };

  const recordLap_MD = (): void => {
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

      handleStopCamera();
      handleSessionCompletion([...lapsRef.current, currentLapTime]);
    }
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
    } catch (error) {
      console.error("Error refreshing data:", error);
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
      console.error("Error saving data:", error);
    }
  };

  const sortSessionsByDate = (sessions: Session[]): Session[] => {
    return [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const startTimer = (): void => {
    if (!selectedDriver || !selectedCar) {
      alert("Please select a driver and car before starting the timer");
      return;
    }
    playStartBeep();
    setStartAnimation(true);
    setTimeout(() => setStartAnimation(false), 500);
    setStartTime(Date.now());
    setIsRunning(true);
    setLaps([]);
  };

  const startTimer_MD = (): void => {
    if (!selectedDriver || !selectedCar) {
      alert("Please select a driver and car before starting the timer");
      return;
    }
    setStartAnimation(true);
    setTimeout(() => setStartAnimation(false), 500);
    setStartTime(Date.now());
    setIsRunning(true);
    setLaps([]);
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
  };

  const stopTimer_MD = (): void => {
    if (!isRunning) return;
    playRaceFinish();
    handleStopCamera();
    setStopAnimation(true);
    setTimeout(() => setStopAnimation(false), 500);
    const finalLaps = [...laps];
    handleSessionCompletion(finalLaps);
  };

  const validateLapCount = (value: string): boolean => {
    const num = parseInt(value, 10);
    return !isNaN(num) && num > 0 && num <= 999;
  };

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

  return (
    <div className="min-h-screen bg-white">
      {/* Main Content Area - with padding for header and bottom nav */}
      <div className="pt-16 pb-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={isMobile ? "mobile" : "desktop"} // Toggle key for layout transitions
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.5 }}
            className={isMobile ? "mobile-layout" : "desktop-layout"} // Apply classes based on layout
          >
            <Tabs defaultValue="current" className="h-full" value={activeTab} onValueChange={setActiveTab}>
              {/* Current Session Tab */}
              <TabsContent value="current" className="px-4 space-y-4 h-full overflow-y-auto">
                <motion.div key={activeTab} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.3 }}>
                  {/* Session Configuration Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Session Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Driver Selection */}
                      <div className="space-y-2">
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
                          <Button variant="outline" onClick={() => setShowNewDriver(!showNewDriver)}>
                            <User className="mr-2 h-4 w-4" />
                            New Driver
                          </Button>
                        </div>
                        {showNewDriver && (
                          <div className="space-y-2">
                            <div className="flex space-x-2">
                              <Input
                                placeholder="Enter driver name"
                                value={newDriverName}
                                onChange={handleDriverNameChange}
                                onKeyPress={(e) => {
                                  if (e.key === "Enter") {
                                    handleAddDriver();
                                  }
                                }}
                                className={newDriverName.trim() && !isDriverNameUnique(newDriverName) ? "border-red-500" : ""}
                              />
                              <Button onClick={handleAddDriver}>Add</Button>
                            </div>
                            {newDriverName.trim() && !isDriverNameUnique(newDriverName) && <div className="text-sm text-red-500">This driver name already exists. Please choose a different name.</div>}
                          </div>
                        )}
                      </div>

                      {/* Car Selection - Only show if driver is selected */}
                      {selectedDriver && (
                        <div className="space-y-2">
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
                            <Button variant="outline" onClick={() => setShowNewCar(!showNewCar)}>
                              <CarIcon className="mr-2 h-4 w-4" />
                              New Car
                            </Button>
                          </div>

                          {selectedDriver && showNewCar && (
                            <div className="space-y-2">
                              <div className="flex space-x-2">
                                <Input
                                  placeholder="Enter car name"
                                  value={newCarName}
                                  onChange={handleCarNameChange}
                                  onKeyPress={(e) => {
                                    if (e.key === "Enter") {
                                      handleAddCar();
                                    }
                                  }}
                                  className={newCarName.trim() && !isCarNameUniqueForDriver(newCarName) ? "border-red-500" : ""}
                                />
                                <Button onClick={handleAddCar}>Add</Button>
                              </div>
                              {newCarName.trim() && !isCarNameUniqueForDriver(newCarName) && <div className="text-sm text-red-500">{drivers.find((d) => d.id === selectedDriver)?.name} already has a car with this name.</div>}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Lap Count Selection */}
                      {selectedDriver && selectedCar && (
                        <div className="space-y-2">
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
                                <SelectItem value="custom">Custom...</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

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
                      )}

                      {/* Session Settings Summary */}
                      {selectedDriver && selectedCar && selectedLapCount && (
                        <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                          <h3 className="font-semibold mb-2">Session Settings</h3>
                          <div className="space-y-1 text-sm">
                            <div>Driver: {drivers.find((d) => d.id === selectedDriver)?.name}</div>
                            <div>Car: {getCurrentDriverCars().find((c) => c.id === selectedCar)?.name}</div>
                            <div>Laps: {selectedLapCount === "unlimited" ? "Unlimited" : selectedLapCount}</div>
                          </div>
                        </div>
                      )}

                      {/* Add Timing Mode Selection */}
                      {selectedDriver && selectedCar && selectedLapCount && (
                        <div className="space-y-2">
                          <Label>Timing Mode</Label>
                          <RadioGroup
                            value={timingMode}
                            onValueChange={(value) => {
                              const newMode = value as "ui" | "motion";
                              setTimingMode(newMode);
                              if (newMode === "motion") {
                                setShowMotionDetector(true);
                                // Reset timer state when switching to motion mode
                                if (isRunning) {
                                  stopTimer();
                                }
                              } else {
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
                          </RadioGroup>
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
                            className="w-full"
                          />
                        </div>
                      )}
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
                                  Driver: {session.driverName} - Car: {session.carName}
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
                                    const hasMaxPenalties = session.stats.maxPenaltyLap === lap.lapNumber;

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
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center py-12">
                          <ListX className="mx-auto h-12 w-12 text-muted-foreground/50" />
                          <h3 className="mt-4 text-lg font-semibold">No Sessions Recorded</h3>
                          <p className="mt-2 text-sm text-muted-foreground">Record your first timing session to see it appear here.</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardHeader>
                        <div className="flex justify-between items-center">
                          <CardTitle>Previous Sessions</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {/* Driver and Car Filters */}
                        <div className="grid grid-cols-2 gap-4 mb-4">
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
                          ).map((session) => (
                            <div key={session.id} className="border-t pt-4 first:border-t-0 first:pt-0">
                              <div className="flex justify-between items-center mb-2">
                                <div>
                                  <h3 className="font-semibold">{formatDateTime(session.date)}</h3>
                                  <div className="text-sm text-muted-foreground">
                                    Driver: {session.driverName} - Car: {session.carName}
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
                                      const hasMaxPenalties = session.stats.maxPenaltyLap === lap.lapNumber;

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
              <TabsContent value="notes" className="space-y-4">
                <motion.div key={activeTab} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.3 }}>
                  <SessionNotes sessions={savedSessions} />
                </motion.div>
              </TabsContent>

              {/* Bottom Navigation */}
              <div className="fixed bottom-0 left-0 right-0 bg-white border-t z-50 shadow-up">
                <TabsList className="grid grid-cols-5 gap-0">
                  <TabsTrigger value="current" className="py-3">
                    <div className="flex flex-col items-center">
                      <PlayCircle className="h-5 w-5" />
                      <span className="text-xs mt-1">Current</span>
                    </div>
                  </TabsTrigger>
                  <TabsTrigger value="previous" className="py-3">
                    <div className="flex flex-col items-center">
                      <ListChecks className="h-5 w-5" />
                      <span className="text-xs mt-1">Previous</span>
                    </div>
                  </TabsTrigger>
                  <TabsTrigger value="best" className="py-3">
                    <div className="flex flex-col items-center">
                      <Trophy className="h-5 w-5" />
                      <span className="text-xs mt-1">Best</span>
                    </div>
                  </TabsTrigger>
                  <TabsTrigger value="compare" className="py-3">
                    <div className="flex flex-col items-center">
                      <BarChart2 className="h-5 w-5" />
                      <span className="text-xs mt-1">Compare</span>
                    </div>
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="py-3">
                    <div className="flex flex-col items-center">
                      <ListPlus className="h-5 w-5" />
                      <span className="text-xs mt-1">Best</span>
                    </div>
                  </TabsTrigger>
                </TabsList>
              </div>
            </Tabs>
          </motion.div>
        </AnimatePresence>

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
                    <span className="animate-spin mr-2">⏳</span>
                    Deleting...
                  </div>
                ) : (
                  "Delete"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </div>
  );
}
