"use client";

import { formatTime, formatDateTime } from "@/lib/utils";
import { SessionComparison } from "./session-comparison";
import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, PlayCircle, StopCircle, ListPlus, Trash2, User, Car as CarIcon } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BestLapRecord, Car, Driver, LapStats, PenaltyData, PersistentData, Session } from "@/types/rc-timer";
import { addDays, format, isBefore, isAfter, startOfDay, endOfDay, parseISO } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import cn from "classnames";

export default function LapTimer() {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [laps, setLaps] = useState<number[]>([]);
  const [savedSessions, setSavedSessions] = useState<Session[]>([]);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [showClearAllDialog, setShowClearAllDialog] = useState<boolean>(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string>("");
  const [selectedCar, setSelectedCar] = useState<string>("");
  const [newDriverName, setNewDriverName] = useState<string>("");
  const [newCarName, setNewCarName] = useState<string>("");
  const [showNewDriver, setShowNewDriver] = useState<boolean>(false);
  const [showNewCar, setShowNewCar] = useState<boolean>(false);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
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

  const timerRef = useRef<NodeJS.Timeout | null>(null);

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

  const BestLapsComparison = ({ sessions }: { sessions: Session[] }) => {
    const [filterDriver, setFilterDriver] = useState<string>("all");
    const [filterCar, setFilterCar] = useState<string>("all");

    const [dateRange, setDateRange] = useState<{
      from: Date | undefined;
      to: Date | undefined;
    }>(() => {
      // Initialize with "Today"
      return {
        from: startOfDay(new Date()),
        to: endOfDay(new Date()),
      };
    });

    // First isWithinDateRange function (for Best Laps Comparison)
    const isWithinDateRange = (sessionDate: string | null): boolean => {
      // If no date range is selected, show all sessions
      if (!dateRange.from && !dateRange.to) return true;

      // If session date is null or invalid, don't show the session
      if (!sessionDate) return false;

      try {
        const date = parseISO(sessionDate);

        if (dateRange.from && !dateRange.to) {
          return isAfter(date, startOfDay(dateRange.from)) || format(date, "yyyy-MM-dd") === format(dateRange.from, "yyyy-MM-dd");
        }

        if (!dateRange.from && dateRange.to) {
          return isBefore(date, endOfDay(dateRange.to)) || format(date, "yyyy-MM-dd") === format(dateRange.to, "yyyy-MM-dd");
        }

        if (dateRange.from && dateRange.to) {
          return (isAfter(date, startOfDay(dateRange.from)) || format(date, "yyyy-MM-dd") === format(dateRange.from, "yyyy-MM-dd")) && (isBefore(date, endOfDay(dateRange.to)) || format(date, "yyyy-MM-dd") === format(dateRange.to, "yyyy-MM-dd"));
        }

        return true;
      } catch (error) {
        console.error("Error parsing date:", error);
        return false;
      }
    };

    // useEffect to initialize filters on mount
    useEffect(() => {
      // Set initial date range (Today)
      setDateRange({
        from: startOfDay(new Date()),
        to: endOfDay(new Date()),
      });
    }, []);

    // Reset car filter when driver changes
    useEffect(() => {
      if (filterDriver === "all" || filterCar !== "all") {
        setFilterCar("all");
      }
    }, [filterDriver]);

    const bestLaps = findBestLaps(sessions);

    // Update your filteredBestLaps to include date filtering
    const filteredBestLaps = findBestLaps(sessions).filter((lap) => {
      if (filterDriver !== "all" && lap.driverName !== filterDriver) return false;
      if (filterCar !== "all" && lap.carName !== filterCar) return false;
      if (!isWithinDateRange(lap.date)) return false;
      return true;
    });

    // Get cars for selected driver
    const getAvailableCars = (driverName: string) => {
      return Array.from(new Set(bestLaps.filter((lap) => lap.driverName === driverName).map((lap) => lap.carName))).filter((name) => name && name.trim() !== "");
    };

    // Get unique drivers
    const uniqueDrivers = Array.from(new Set(bestLaps.map((lap) => lap.driverName))).filter((name) => name && name.trim() !== "");

    return (
      <Card>
        <CardHeader>
          <CardTitle>Best Laps Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="space-x-4 mb-4">
            <div className="space-y-2">
              <Label>Filter by Driver</Label>
              <Select
                value={filterDriver}
                onValueChange={(value) => {
                  setFilterDriver(value);
                  setFilterCar("all"); // Reset car filter when driver changes
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Drivers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Drivers</SelectItem>
                  {uniqueDrivers.map((driver) => (
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
                <SelectTrigger className="w-[200px]" disabled={filterDriver === "all"}>
                  <SelectValue placeholder={filterDriver === "all" ? "Select a driver first" : "All Cars"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cars</SelectItem>
                  {filterDriver !== "all" &&
                    getAvailableCars(filterDriver).map((car) => (
                      <SelectItem key={car} value={car}>
                        {car}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Filter */}
            <div className="space-y-2">
              <Label>Filter by Date Range</Label>

              {/* Preset Buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                {DATE_PRESETS.map((preset) => {
                  const presetDates = getPresetDates(preset);
                  const isActive = dateRange.from && dateRange.to && format(dateRange.from, "yyyy-MM-dd") === format(presetDates.from, "yyyy-MM-dd") && format(dateRange.to, "yyyy-MM-dd") === format(presetDates.to, "yyyy-MM-dd");

                  return (
                    <Button
                      key={preset.label}
                      variant="outline"
                      size="sm"
                      className={cn("hover:bg-muted", isActive ? "bg-primary text-primary-foreground hover:bg-primary/90" : "")}
                      onClick={() => {
                        const { from, to } = getPresetDates(preset);
                        setDateRange({ from, to });
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
                    <Button variant="outline" className={cn("w-full sm:w-[240px] justify-start text-left font-normal", !dateRange.from && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.from ? format(dateRange.from, "PPP") : "Select start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateRange.from} onSelect={(date) => setDateRange((prev) => ({ ...prev, from: date }))} initialFocus />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full sm:w-[240px] justify-start text-left font-normal", !dateRange.to && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.to ? format(dateRange.to, "PPP") : "Select end date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateRange.to} onSelect={(date) => setDateRange((prev) => ({ ...prev, to: date }))} disabled={(date) => (dateRange.from ? isBefore(date, dateRange.from) : false)} initialFocus />
                  </PopoverContent>
                </Popover>

                <Button variant="outline" onClick={() => setDateRange({ from: undefined, to: undefined })} className="w-full sm:w-auto">
                  Reset Dates
                </Button>
              </div>

              {/* Date Range Summary */}
              {(dateRange.from || dateRange.to) && (
                <div className="text-sm text-muted-foreground">
                  {dateRange.from && dateRange.to && format(dateRange.from, "yyyy-MM-dd") === format(startOfDay(new Date()), "yyyy-MM-dd") && format(dateRange.to, "yyyy-MM-dd") === format(endOfDay(new Date()), "yyyy-MM-dd") ? (
                    "Showing sessions from today"
                  ) : dateRange.from && dateRange.to && format(dateRange.from, "yyyy-MM-dd") === format(getPresetDates(DATE_PRESETS[1]).from, "yyyy-MM-dd") && format(dateRange.to, "yyyy-MM-dd") === format(getPresetDates(DATE_PRESETS[1]).to, "yyyy-MM-dd") ? (
                    "Showing sessions from the last 7 days"
                  ) : (
                    <>
                      Showing sessions
                      {dateRange.from && !dateRange.to && ` from ${format(dateRange.from, "PPP")}`}
                      {!dateRange.from && dateRange.to && ` until ${format(dateRange.to, "PPP")}`}
                      {dateRange.from && dateRange.to && ` from ${format(dateRange.from, "PPP")} to ${format(dateRange.to, "PPP")}`}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Best Laps Table */}
          <div className="rounded-md border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-2 text-left">Rank</th>
                  <th className="p-2 text-left">Driver</th>
                  <th className="p-2 text-left">Car</th>
                  <th className="p-2 text-right">Lap Time</th>
                  <th className="p-2 text-right">Lap #</th>
                  <th className="p-2 text-right">Penalties</th>
                  <th className="p-2 text-right">Session Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredBestLaps.map((lap, index) => (
                  <tr
                    key={`${lap.sessionId}-${lap.lapNumber}`}
                    className={`border-b ${index === 0 ? "bg-green-50" : ""} 
            hover:bg-muted/50 transition-colors`}
                  >
                    <td className="p-2">{index === 0 ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Best</span> : `#${index + 1}`}</td>
                    <td className="p-2">{lap.driverName}</td>
                    <td className="p-2">{lap.carName}</td>
                    <td className="p-2 text-right font-mono">
                      {formatTime(lap.lapTime)}
                      {index === 0 && <span className="ml-2 text-xs text-green-600">⚡ Fastest</span>}
                    </td>
                    <td className="p-2 text-right">{lap.lapNumber}</td>
                    <td className="p-2 text-right">
                      {lap.penalties > 0 && <span className="text-yellow-600 font-medium">{lap.penalties}</span>}
                      {!lap.penalties && "-"}
                    </td>
                    <td className="p-2 text-right text-sm text-muted-foreground">{formatDateTime(lap.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredBestLaps.length === 0 && <div className="text-center py-8 text-muted-foreground">No lap times found for the selected filters.</div>}
        </CardContent>
      </Card>
    );
  };

  const calculateStats = (lapTimes: number[]): LapStats => {
    if (lapTimes.length === 0)
      return {
        average: 0,
        mean: 0,
        totalTime: 0,
        maxPenaltyLap: null,
        maxPenaltyCount: 0,
      };

    const sum = lapTimes.reduce((a, b) => a + b, 0);
    const average = sum / lapTimes.length;
    const sortedLaps = [...lapTimes].sort((a, b) => a - b);
    const mean = sortedLaps[Math.floor(sortedLaps.length / 2)];

    // Find max penalties
    const maxPenalty = penalties.reduce((max, p) => (p.count > max.count ? p : max), { lapNumber: 0, count: 0 });

    return {
      average,
      mean,
      totalTime: sum,
      maxPenaltyLap: maxPenalty.count > 0 ? maxPenalty.lapNumber : null,
      maxPenaltyCount: maxPenalty.count,
    };
  };

  const clearAllSessions = (): void => {
    // If there's a current session, keep only that one
    if (currentSessionId) {
      setSavedSessions(savedSessions.filter((session) => session.id === currentSessionId));
    } else {
      setSavedSessions([]);
    }
    setShowClearAllDialog(false);
  };

  const deleteSession = (sessionId: number): void => {
    setSavedSessions(savedSessions.filter((session) => session.id !== sessionId));
    setSessionToDelete(null);
  };

  const findBestLaps = (sessions: Session[]): BestLapRecord[] => {
    const bestLaps: BestLapRecord[] = [];

    sessions.forEach((session) => {
      const bestLapTime = Math.min(...session.laps);
      const lapNumber = session.laps.indexOf(bestLapTime) + 1;

      // Get penalties for this specific lap
      const lapPenalties = session.penalties?.find((p) => p.lapNumber === lapNumber)?.count || 0;

      bestLaps.push({
        sessionId: session.id,
        date: session.date,
        driverName: session.driverName,
        carName: session.carName,
        lapTime: bestLapTime,
        lapNumber: lapNumber,
        penalties: lapPenalties, // Add penalties to the record
      });
    });

    // Sort by lap time (fastest first)
    return bestLaps.sort((a, b) => a.lapTime - b.lapTime);
  };

  const getBestLap = (laps: number[]) => {
    if (laps.length === 0) return null;
    const bestTime = Math.min(...laps);
    const bestLapIndex = laps.indexOf(bestTime);
    return { time: bestTime, lapNumber: bestLapIndex + 1 };
  };

  const getCurrentDriverCars = () => {
    const driver = drivers.find((d) => d.id === selectedDriver);
    return driver?.cars || [];
  };

  // Helper function to calculate current lap time
  const getCurrentLapTime = (): number => {
    if (!isRunning || !startTime) return 0;
    const totalElapsedTime = currentTime;
    const previousLapsTime = laps.reduce((sum, lap) => sum + lap, 0);
    return totalElapsedTime - previousLapsTime;
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

  const handleAddCar = () => {
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

    const newCar: Car = {
      id: Date.now().toString(),
      name: trimmedName,
    };

    setDrivers((prevDrivers) =>
      prevDrivers.map((driver) => {
        if (driver.id === selectedDriver) {
          return {
            ...driver,
            cars: [...driver.cars, newCar],
          };
        }
        return driver;
      })
    );

    setSelectedCar(newCar.id);
    setNewCarName("");
    setShowNewCar(false);
    saveData();
  };

  const handleAddDriver = () => {
    const trimmedName = newDriverName.trim();

    if (!trimmedName) {
      alert("Please enter a driver name");
      return;
    }

    if (!isDriverNameUnique(trimmedName)) {
      alert(`A driver named "${trimmedName}" already exists. Please use a different name.`);
      return;
    }

    const newDriver: Driver = {
      id: Date.now().toString(),
      name: trimmedName,
      cars: [],
    };

    setDrivers((prevDrivers) => [...prevDrivers, newDriver]);
    setSelectedDriver(newDriver.id);
    setNewDriverName("");
    setShowNewDriver(false);
    setSelectedCar("");
    saveData();
  };

  const handleCarNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setNewCarName(newName);
  };

  const handleDriverNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setNewDriverName(newName);
  };

  const handleSessionCompletion = (completedLaps: number[]): void => {
    setIsRunning(false);

    const driver = drivers.find((d) => d.id === selectedDriver);
    const car = driver?.cars.find((c) => c.id === selectedCar);

    const newSession: Session = {
      id: Date.now(),
      date: sessionStartTime ?? new Date().toISOString(),
      driverId: selectedDriver,
      driverName: driver?.name ?? "",
      carId: selectedCar,
      carName: car?.name ?? "",
      laps: completedLaps,
      stats: calculateStats(completedLaps),
      totalLaps: selectedLapCount,
      penalties: penalties, // Add the penalties array
      totalPenalties: penalties.reduce((sum, p) => sum + p.count, 0), // Add total penalties
    };

    setCurrentSession(null);
    setPenalties([]); // Reset penalties for next session
    setSavedSessions((prev) => [newSession, ...prev]);
    saveData();
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

      const data: PersistentData = await response.json();
      setSavedSessions(data.sessions || []);
      setDrivers(data.drivers || []);
      console.log("Data loaded:", data.lastUpdated);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const recordLap = (): void => {
    if (!isRunning) return;

    setLapAnimation(true);
    setTimeout(() => setLapAnimation(false), 300);

    const lastLapEndTime = laps.reduce((sum, lap) => sum + lap, 0);
    const currentLapTime = currentTime - lastLapEndTime;
    const newLaps = [...laps, currentLapTime];
    setLaps(newLaps);

    // Check if we've reached the selected number of laps
    if (selectedLapCount !== "unlimited" && newLaps.length >= selectedLapCount) {
      // Automatically stop the timer and save the session
      handleSessionCompletion(newLaps);
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
      console.log("Data saved:", data.lastUpdated);
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
    setStartAnimation(true);
    setTimeout(() => setStartAnimation(false), 500);
    setStartTime(Date.now());
    setIsRunning(true);
    setLaps([]);
  };

  const stopTimer = (): void => {
    if (!isRunning) return;
    setStopAnimation(true);
    setTimeout(() => setStopAnimation(false), 500);
    const finalLapTime = currentTime - (laps.length > 0 ? laps.reduce((a, b) => a + b, 0) : 0);
    const finalLaps = [...laps, finalLapTime];
    handleSessionCompletion(finalLaps);
  };

  const validateLapCount = (value: string): boolean => {
    const num = parseInt(value, 10);
    return !isNaN(num) && num > 0 && num <= 999;
  };

  // Render Component
  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
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
                  {drivers.map((driver) => (
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
                    {getCurrentDriverCars().map((car) => (
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
          <div className="flex justify-center space-x-4">
            <Button onClick={startTimer} disabled={isRunning || !selectedDriver || !selectedCar} className={cn("bg-green-500 hover:bg-green-600 transition-all", startAnimation && "animate-timer-start")}>
              <PlayCircle className="mr-2 h-4 w-4" />
              Start Lap Timer
            </Button>
            <Button onClick={recordLap} disabled={!isRunning} className={cn("bg-blue-500 hover:bg-blue-600 transition-all", lapAnimation && "animate-lap-record")}>
              <ListPlus className="mr-2 h-4 w-4" />
              Record Lap
            </Button>
            <Button onClick={stopTimer} disabled={!isRunning} className={cn("bg-red-500 hover:bg-red-600 transition-all", stopAnimation && "animate-timer-stop")}>
              <StopCircle className="mr-2 h-4 w-4" />
              Stop Lap Timer
            </Button>
          </div>

          {/* Penalty controls */}
          <div className="flex justify-center space-x-4">
            <Button onClick={addPenalty} disabled={!isRunning} className={cn("bg-yellow-500 hover:bg-yellow-600 transition-all", penaltyAnimation && "animate-penalty-add")}>
              <AlertTriangle className="mr-2 h-4 w-4" />
              Add Penalty
            </Button>
          </div>
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
                  <div className="font-mono">Time: {sessionStartTime ? formatDateTime(sessionStartTime) : "Not started"}</div>
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
                            {lapPenalties} Penalty{lapPenalties > 1 ? "ies" : ""}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Current Session statistics */}
                <div>
                  <h3 className="font-semibold">Statistics:</h3>
                  <div className="font-mono">Average: {formatTime(calculateStats(laps).average)}</div>
                  <div className="font-mono">Mean: {formatTime(calculateStats(laps).mean)}</div>
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

      {/* Previous Sessions Display */}
      {savedSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Previous Sessions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date Range Filter */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Filter by Date Range</Label>
                <Button onClick={() => setShowClearAllDialog(true)} variant="destructive" size="sm" className="bg-red-500 hover:bg-red-600">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear All
                </Button>
              </div>

              {/* Preset Buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                {DATE_PRESETS.map((preset) => {
                  const presetDates = getPresetDates(preset);
                  const isActive = previousSessionsDateRange.from && previousSessionsDateRange.to && format(previousSessionsDateRange.from, "yyyy-MM-dd") === format(presetDates.from, "yyyy-MM-dd") && format(previousSessionsDateRange.to, "yyyy-MM-dd") === format(presetDates.to, "yyyy-MM-dd");

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
                  {previousSessionsDateRange.from && previousSessionsDateRange.to && format(previousSessionsDateRange.from, "yyyy-MM-dd") === format(startOfDay(new Date()), "yyyy-MM-dd") && format(previousSessionsDateRange.to, "yyyy-MM-dd") === format(endOfDay(new Date()), "yyyy-MM-dd") ? (
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
              {sortSessionsByDate(savedSessions.filter((session) => (currentSession ? session.id !== currentSession.id : true)).filter((session) => isWithinPreviousSessionsDateRange(session.date))).map((session) => (
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
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    {/* Previous Sessions Lap Times */}
                    <div>
                      <h4 className="font-semibold mb-2">Lap Times:</h4>
                      {session.laps.map((lap, index) => {
                        const lapNumber = index + 1;
                        const lapPenalties = session.penalties.find((p) => p.lapNumber === lapNumber)?.count || 0;
                        const bestLap = Math.min(...session.laps);
                        const worstLap = Math.max(...session.laps);
                        const isBestLap = lap === bestLap;
                        const isWorstLap = lap === worstLap;
                        const hasMaxPenalties = session.stats.maxPenaltyLap === lapNumber;

                        return (
                          <div key={index} className={cn("font-mono flex items-center", isBestLap ? "text-green-600 font-bold" : "", isWorstLap ? "text-red-600 font-bold" : "", hasMaxPenalties ? "bg-yellow-50" : "")}>
                            <span className="min-w-[100px]">
                              Lap {lapNumber}: {formatTime(lap)}
                            </span>
                            {isBestLap && <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Best Lap</span>}
                            {isWorstLap && <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">Slowest Lap</span>}
                            {lapPenalties > 0 && (
                              <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                                {lapPenalties} Penalty{lapPenalties > 1 ? "ies" : ""}
                              </span>
                            )}
                            {hasMaxPenalties && <span className="ml-2 text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full">Most Penalties</span>}
                          </div>
                        );
                      })}
                    </div>

                    {/* Previous Sessions Statistics */}
                    <div>
                      <h4 className="font-semibold mb-2">Statistics:</h4>
                      <div className="font-mono">Average: {formatTime(session.stats.average)}</div>
                      <div className="font-mono">Mean: {formatTime(session.stats.mean)}</div>
                      <div className="space-y-1 mt-2">
                        <div className="font-mono text-green-600 font-bold">Best Lap: {formatTime(Math.min(...session.laps))}</div>
                        <div className="font-mono text-red-600 font-bold">Slowest Lap: {formatTime(Math.max(...session.laps))}</div>
                        <div className="font-mono mt-2">Total Penalties: {session.totalPenalties}</div>
                      </div>
                      <div className="font-mono mt-2">Total Time: {formatTime(session.stats.totalTime)}</div>
                      <div className="font-mono">Total Laps: {session.laps.length}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {savedSessions.filter((session) => isWithinDateRange(session.date)).length === 0 && <div className="text-center py-8 text-muted-foreground">No sessions found for the selected date range.</div>}
          </CardContent>
        </Card>
      )}

      {/* Best Lap Comparison Display */}
      {Array.isArray(savedSessions) && savedSessions.length > 0 && <BestLapsComparison sessions={savedSessions} />}

      {/* Session Comparison Display */}
      {Array.isArray(savedSessions) && savedSessions.length > 1 && <SessionComparison sessions={savedSessions} />}

      {/* Delete Session Dialog */}
      <AlertDialog open={!!sessionToDelete} onOpenChange={() => setSessionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete the session from {sessionToDelete?.date}? If you delete this session, it's gone for good. So make sure this what you really want to do!!</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteSession(sessionToDelete?.id!)} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Dialog */}
      <AlertDialog open={showClearAllDialog} onOpenChange={setShowClearAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Sessions</AlertDialogTitle>
            <AlertDialogDescription>WHOA!! You're about to delete ALL YOUR SESSSIONS! Literally all the laps you've ever recorded are going to get deleted and YOU CAN'T EVER GET THEM BACK!!! ARE YOU SURE YOU WANT TO DO THIS???</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={clearAllSessions} className="bg-red-500 hover:bg-red-600">
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
