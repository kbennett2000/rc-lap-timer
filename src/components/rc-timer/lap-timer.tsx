"use client";

// 1. Imports
import { formatTime, formatDateTime } from "@/lib/utils";
import { SessionComparison } from "./session-comparison";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  PlayCircle,
  StopCircle,
  ListPlus,
  Trash2,
  Download,
  Upload,
  User,
  Car as CarIcon,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Driver,
  Car,
  Session,
  LapStats,
  StoredData,
  BestLapRecord,
} from "@/types/rc-timer";

export default function LapTimer() {
  // 2. State definitions
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
  const [selectedLapCount, setSelectedLapCount] = useState<
    "unlimited" | number
  >("unlimited");
  const [inputLapCount, setInputLapCount] = useState<string>("");
  const [showLapCountInput, setShowLapCountInput] = useState<boolean>(false);

  // 3. Refs
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 4. Effects
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
    localStorage.setItem(
      "rc-lap-timer-sessions",
      JSON.stringify(savedSessions)
    );
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

  // 5. Utility Functions
  const calculateStats = (lapTimes: number[]): LapStats => {
    if (lapTimes.length === 0) return { average: 0, mean: 0 };
    const sum = lapTimes.reduce((a, b) => a + b, 0);
    const average = sum / lapTimes.length;
    const sortedLaps = [...lapTimes].sort((a, b) => a - b);
    const mean = sortedLaps[Math.floor(sortedLaps.length / 2)];
    return { average, mean };
  };

  const getCurrentDriverCars = (): Car[] => {
    const driver = drivers.find((d) => d.id === selectedDriver);
    return driver ? driver.cars : [];
  };

  const validateLapCount = (value: string): boolean => {
    const num = parseInt(value, 10);
    return !isNaN(num) && num > 0 && num <= 999;
  };

  const handleSessionCompletion = (completedLaps: number[]): void => {
    setIsRunning(false);

    const driver = drivers.find((d) => d.id === selectedDriver);
    const car = driver?.cars.find((c) => c.id === selectedCar);

    const newSession: Session = {
      id: Date.now(),
      date: sessionStartTime!,
      driverId: selectedDriver,
      driverName: driver?.name ?? "",
      carId: selectedCar,
      carName: car?.name ?? "",
      laps: completedLaps,
      stats: calculateStats(completedLaps),
      totalLaps: selectedLapCount,
    };

    setCurrentSession(newSession);
    setSavedSessions([newSession, ...savedSessions]);
  };

  // 6. Driver and Car Management
  const addNewDriver = (): void => {
    if (!newDriverName.trim()) return;
    const newDriver: Driver = {
      id: Date.now().toString(),
      name: newDriverName.trim(),
      cars: [],
    };
    setDrivers([...drivers, newDriver]);
    setSelectedDriver(newDriver.id);
    setNewDriverName("");
    setShowNewDriver(false);
  };

  const addNewCar = (): void => {
    if (!newCarName.trim() || !selectedDriver) return;
    const newCar: Car = {
      id: Date.now().toString(),
      name: newCarName.trim(),
    };
    setDrivers(
      drivers.map((driver) => {
        if (driver.id === selectedDriver) {
          return { ...driver, cars: [...driver.cars, newCar] };
        }
        return driver;
      })
    );
    setSelectedCar(newCar.id);
    setNewCarName("");
    setShowNewCar(false);
  };

  // 7. Timer Controls
  const startTimer = (): void => {
    if (!selectedDriver || !selectedCar) {
      alert("Please select a driver and car before starting the timer");
      return;
    }
    setStartTime(Date.now());
    setIsRunning(true);
    setLaps([]);
    setSessionStartTime(new Date().toISOString()); // Set session start time
    setCurrentSession(null); // Reset current session when starting new
  };

  const recordLap = (): void => {
    if (!isRunning) return;

    const lastLapEndTime = laps.reduce((sum, lap) => sum + lap, 0);
    const currentLapTime = currentTime - lastLapEndTime;

    const newLaps = [...laps, currentLapTime];
    setLaps(newLaps);

    // Check if we've reached the selected number of laps
    if (
      selectedLapCount !== "unlimited" &&
      newLaps.length >= selectedLapCount
    ) {
      // Automatically stop the timer and save the session
      handleSessionCompletion(newLaps);
    }
  };

  const stopTimer = (): void => {
    if (!isRunning || !sessionStartTime) return;
    const finalLapTime =
      currentTime - (laps.length > 0 ? laps.reduce((a, b) => a + b, 0) : 0);
    const finalLaps = [...laps, finalLapTime];
    handleSessionCompletion(finalLaps);
  };

  // 8. Data Management
  const deleteSession = (sessionId: number): void => {
    setSavedSessions(
      savedSessions.filter((session) => session.id !== sessionId)
    );
    setSessionToDelete(null);
  };

  const clearAllSessions = (): void => {
    // If there's a current session, keep only that one
    if (currentSessionId) {
      setSavedSessions(
        savedSessions.filter((session) => session.id === currentSessionId)
      );
    } else {
      setSavedSessions([]);
    }
    setShowClearAllDialog(false);
  };

  const exportData = (): void => {
    // Add safety check at the start of the function
    if (!hasRecordedSessions()) {
      alert("Please record at least one session before exporting data.");
      return;
    }

    try {
      const data: StoredData = {
        sessions: savedSessions,
        drivers: drivers,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rc-lap-timer-data-${
        new Date().toISOString().split("T")[0]
      }.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert("Data exported successfully!");
    } catch (error) {
      console.error("Error exporting data:", error);
      alert("Error exporting data. Please try again.");
    }
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result as string) as StoredData;
        if (imported.sessions && imported.drivers) {
          console.log("Importing data:", imported); // Debug log
          setSavedSessions(imported.sessions);
          setDrivers(imported.drivers);

          // Force a re-render by updating state
          setCurrentSession(null);
          setLaps([]);
          setIsRunning(false);
          setSelectedDriver("");
          setSelectedCar("");
        }
      } catch (error) {
        console.error("Error importing data:", error);
        alert("Error importing data. Please check the file format.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const hasRecordedSessions = (): boolean => {
    return Array.isArray(savedSessions) && savedSessions.length > 0;
  };

  const findBestLaps = (sessions: Session[]): BestLapRecord[] => {
    const bestLaps: BestLapRecord[] = [];

    sessions.forEach((session) => {
      const bestLapTime = Math.min(...session.laps);
      const lapNumber = session.laps.indexOf(bestLapTime) + 1;

      bestLaps.push({
        sessionId: session.id,
        date: session.date, // Use the full session timestamp
        driverName: session.driverName,
        carName: session.carName,
        lapTime: bestLapTime,
        lapNumber: lapNumber,
      });
    });

    // Sort by lap time (fastest first)
    return bestLaps.sort((a, b) => a.lapTime - b.lapTime);
  };

  const BestLapsComparison = ({ sessions }: { sessions: Session[] }) => {
    const [filterDriver, setFilterDriver] = useState<string>("all");
    const [filterCar, setFilterCar] = useState<string>("all");

    const bestLaps = findBestLaps(sessions);

    // Get unique drivers
    const uniqueDrivers = Array.from(
      new Set(bestLaps.map((lap) => lap.driverName))
    ).filter((name) => name && name.trim() !== "");

    // Get cars for selected driver
    const getAvailableCars = (driverName: string) => {
      return Array.from(
        new Set(
          bestLaps
            .filter((lap) => lap.driverName === driverName)
            .map((lap) => lap.carName)
        )
      ).filter((name) => name && name.trim() !== "");
    };

    // Reset car filter when driver changes
    useEffect(() => {
      if (filterDriver === "all" || filterCar !== "all") {
        setFilterCar("all");
      }
    }, [filterDriver]);

    // Filter the best laps
    const filteredBestLaps = bestLaps.filter((lap) => {
      if (filterDriver !== "all" && lap.driverName !== filterDriver)
        return false;
      if (
        filterDriver !== "all" &&
        filterCar !== "all" &&
        lap.carName !== filterCar
      )
        return false;
      return true;
    });

    return (
      <Card>
        <CardHeader>
          <CardTitle>Best Laps Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex space-x-4 mb-4">
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
              <Select
                value={filterCar}
                onValueChange={setFilterCar}
                disabled={filterDriver === "all"}
              >
                <SelectTrigger
                  className="w-[200px]"
                  disabled={filterDriver === "all"}
                >
                  <SelectValue
                    placeholder={
                      filterDriver === "all"
                        ? "Select a driver first"
                        : "All Cars"
                    }
                  />
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
                    <td className="p-2">
                      {index === 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Best
                        </span>
                      ) : (
                        `#${index + 1}`
                      )}
                    </td>
                    <td className="p-2">{lap.driverName}</td>
                    <td className="p-2">{lap.carName}</td>
                    <td className="p-2 text-right font-mono">
                      {formatTime(lap.lapTime)}
                      {index === 0 && (
                        <span className="ml-2 text-xs text-green-600">
                          ⚡ Fastest
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-right">{lap.lapNumber}</td>
                    <td className="p-2 text-right text-sm text-muted-foreground">
                      {formatDateTime(lap.date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredBestLaps.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No lap times found for the selected filters.
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const getBestLap = (laps: number[]) => {
    if (laps.length === 0) return null;
    const bestTime = Math.min(...laps);
    const bestLapIndex = laps.indexOf(bestTime);
    return { time: bestTime, lapNumber: bestLapIndex + 1 };
  };

  // 9. Render Component
  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      {/* Data Management Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Data Management</CardTitle>
          <div className="flex space-x-2">
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              size="sm"
            >
              <Upload className="mr-2 h-4 w-4" />
              Import Data
            </Button>
            <Button
              onClick={exportData}
              variant="outline"
              size="sm"
              disabled={!hasRecordedSessions()}
              title={
                !hasRecordedSessions()
                  ? "Record at least one session before exporting"
                  : "Export recorded sessions"
              }
            >
              <Download className="mr-2 h-4 w-4" />
              Export Data
            </Button>
          </div>
        </CardHeader>
        {!hasRecordedSessions() && (
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Record at least one lap timing session to enable data export.
            </p>
          </CardContent>
        )}
      </Card>

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
              <Button
                variant="outline"
                onClick={() => setShowNewDriver(!showNewDriver)}
              >
                <User className="mr-2 h-4 w-4" />
                New Driver
              </Button>
            </div>
            {showNewDriver && (
              <div className="flex space-x-2 mt-2">
                <Input
                  placeholder="Enter driver name"
                  value={newDriverName}
                  onChange={(e) => setNewDriverName(e.target.value)}
                />
                <Button onClick={addNewDriver}>Add</Button>
              </div>
            )}
          </div>

          {/* Car Selection */}
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
                <Button
                  variant="outline"
                  onClick={() => setShowNewCar(!showNewCar)}
                >
                  <CarIcon className="mr-2 h-4 w-4" />
                  New Car
                </Button>
              </div>
              {showNewCar && (
                <div className="flex space-x-2 mt-2">
                  <Input
                    placeholder="Enter car name"
                    value={newCarName}
                    onChange={(e) => setNewCarName(e.target.value)}
                  />
                  <Button onClick={addNewCar}>Add</Button>
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
                  value={
                    showLapCountInput ? "custom" : selectedLapCount.toString()
                  }
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
                  <Input
                    type="number"
                    min="1"
                    max="999"
                    placeholder="Enter number of laps"
                    value={inputLapCount}
                    onChange={(e) => setInputLapCount(e.target.value)}
                  />
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

              <div className="text-sm text-muted-foreground mt-1">
                {selectedLapCount === "unlimited"
                  ? "Session will continue until manually stopped"
                  : `Session will automatically complete after ${selectedLapCount} laps`}
              </div>
            </div>
          )}

          {/* Session Settings Summary */}
          {selectedDriver && selectedCar && selectedLapCount && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <h3 className="font-semibold mb-2">Session Settings</h3>
              <div className="space-y-1 text-sm">
                <div>
                  Driver: {drivers.find((d) => d.id === selectedDriver)?.name}
                </div>
                <div>
                  Car:{" "}
                  {
                    getCurrentDriverCars().find((c) => c.id === selectedCar)
                      ?.name
                  }
                </div>
                <div>
                  Laps:{" "}
                  {selectedLapCount === "unlimited"
                    ? "Unlimited"
                    : selectedLapCount}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timer Display */}
      <Card>
        <CardHeader>
          <CardTitle className="text-center text-4xl font-mono">
            {formatTime(currentTime)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add lap counter */}
          <div className="text-center text-lg font-mono mb-4">
            Lap: {laps.length + 1}
          </div>

          {/* Timer controls */}
          <div className="flex justify-center space-x-4">
            <Button
              onClick={startTimer}
              disabled={isRunning || !selectedDriver || !selectedCar}
              className="bg-green-500 hover:bg-green-600"
            >
              <PlayCircle className="mr-2 h-4 w-4" />
              Start Lap Timer
            </Button>
            <Button
              onClick={recordLap}
              disabled={!isRunning}
              className="bg-blue-500 hover:bg-blue-600"
            >
              <ListPlus className="mr-2 h-4 w-4" />
              Record Lap
            </Button>
            <Button
              onClick={stopTimer}
              disabled={!isRunning}
              className="bg-red-500 hover:bg-red-600"
            >
              <StopCircle className="mr-2 h-4 w-4" />
              Stop Lap Timer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Session Display */}
      {(laps.length > 0 || currentSession) && (
        <Card>
          <CardHeader>
            <CardTitle>Current Session</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold">Session Info:</h3>
                  <div className="font-mono">
                    Driver: {drivers.find((d) => d.id === selectedDriver)?.name}
                  </div>
                  <div className="font-mono">
                    Car:{" "}
                    {
                      getCurrentDriverCars().find((c) => c.id === selectedCar)
                        ?.name
                    }
                  </div>
                  <div className="font-mono">
                    Time:{" "}
                    {currentSession
                      ? formatDateTime(currentSession.date)
                      : sessionStartTime
                      ? formatDateTime(sessionStartTime)
                      : "Not started"}
                  </div>
                  <h3 className="font-semibold mt-4">Lap Times:</h3>
                  {laps.map((lap, index) => {
                    const bestLap = getBestLap(laps);
                    const isBestLap =
                      bestLap && index === bestLap.lapNumber - 1;
                    return (
                      <div
                        key={index}
                        className={`font-mono ${
                          isBestLap
                            ? "text-green-600 font-bold flex items-center"
                            : ""
                        }`}
                      >
                        Lap {index + 1}: {formatTime(lap)}
                        {isBestLap && (
                          <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                            Best Lap
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div>
                  <h3 className="font-semibold">Statistics:</h3>
                  <div className="font-mono">
                    Average: {formatTime(calculateStats(laps).average)}
                  </div>
                  <div className="font-mono">
                    Mean: {formatTime(calculateStats(laps).mean)}
                  </div>
                  {laps.length > 0 && (
                    <div className="font-mono text-green-600 font-bold mt-2">
                      Best Lap: {formatTime(Math.min(...laps))}
                    </div>
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
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Previous Sessions</CardTitle>
            <div className="flex space-x-2">
              <Button
                onClick={() => setShowClearAllDialog(true)}
                variant="destructive"
                size="sm"
                className="bg-red-500 hover:bg-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {savedSessions
                .filter((session) =>
                  currentSession ? session.id !== currentSession.id : true
                )
                .map((session) => (
                  <div
                    key={session.id}
                    className="border-t pt-4 first:border-t-0 first:pt-0"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <h3 className="font-semibold">
                          {formatDateTime(session.date)}
                        </h3>
                        <div className="text-sm text-muted-foreground">
                          Driver: {session.driverName} - Car: {session.carName}
                        </div>
                      </div>
                      <Button
                        onClick={() => setSessionToDelete(session)}
                        variant="destructive"
                        size="sm"
                        className="bg-red-500 hover:bg-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <h4 className="font-semibold mb-2">Lap Times:</h4>
                        {session.laps.map((lap, index) => {
                          const bestLap = getBestLap(session.laps);
                          const isBestLap =
                            bestLap && index === bestLap.lapNumber - 1;
                          return (
                            <div
                              key={index}
                              className={`font-mono ${
                                isBestLap
                                  ? "text-green-600 font-bold flex items-center"
                                  : ""
                              }`}
                            >
                              Lap {index + 1}: {formatTime(lap)}
                              {isBestLap && (
                                <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                  Best Lap
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Statistics:</h4>
                        <div className="font-mono">
                          Average: {formatTime(session.stats.average)}
                        </div>
                        <div className="font-mono">
                          Mean: {formatTime(session.stats.mean)}
                        </div>
                        <div className="font-mono text-green-600 font-bold mt-2">
                          Best Lap: {formatTime(Math.min(...session.laps))}
                        </div>
                        <div className="font-mono">
                          Total Laps: {session.laps.length}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 border-b"></div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Best Lap Comparison Display */}
      {Array.isArray(savedSessions) && savedSessions.length > 0 && (
        <BestLapsComparison sessions={savedSessions} />
      )}

      {/* Session Comparison Display */}
      {Array.isArray(savedSessions) && savedSessions.length > 1 && (
        <SessionComparison sessions={savedSessions} />
      )}

      {/* Hidden file input for import */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".json"
        onChange={importData}
      />

      {/* Delete Session Dialog */}
      <AlertDialog
        open={!!sessionToDelete}
        onOpenChange={() => setSessionToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the session from{" "}
              {sessionToDelete?.date}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSession(sessionToDelete?.id!)}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Dialog */}
      <AlertDialog
        open={showClearAllDialog}
        onOpenChange={setShowClearAllDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Sessions</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all saved sessions? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={clearAllSessions}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
