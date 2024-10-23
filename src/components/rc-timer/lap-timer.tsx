"use client";

// 1. Imports
import { formatTime } from '@/lib/utils';
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
import { Driver, Car, Session, LapStats, StoredData, BestLapRecord } from "@/types/rc-timer";

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
    setCurrentSession(null); // Reset current session when starting new session
  };

  const recordLap = (): void => {
    if (!isRunning) return;
    const lapTime =
      currentTime - (laps.length > 0 ? laps.reduce((a, b) => a + b, 0) : 0);
    setLaps([...laps, lapTime]);
  };

  const stopTimer = (): void => {
    if (!isRunning) return;
    const finalLapTime =
      currentTime - (laps.length > 0 ? laps.reduce((a, b) => a + b, 0) : 0);
    const finalLaps = [...laps, finalLapTime];
    setLaps(finalLaps);
    setIsRunning(false);

    const driver = drivers.find((d) => d.id === selectedDriver);
    const car = driver?.cars.find((c) => c.id === selectedCar);
    const bestLap = Math.min(...finalLaps);

    const newSession: Session = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      driverId: selectedDriver,
      driverName: driver?.name ?? "",
      carId: selectedCar,
      carName: car?.name ?? "",
      laps: finalLaps,
      stats: calculateStats(finalLaps),
      bestLap,
    };

    setCurrentSession(newSession);
    setSavedSessions([newSession, ...savedSessions]);
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

  interface LapAnalysis {
    time: number;
    isBest: boolean;
  }

  const analyzeLaps = (laps: number[]): LapAnalysis[] => {
    if (!laps.length) return [];
    const bestLap = Math.min(...laps);
    return laps.map((lap) => ({
      time: lap,
      isBest: lap === bestLap,
    }));
  };

  const findBestLaps = (sessions: Session[]): BestLapRecord[] => {
    const bestLaps: BestLapRecord[] = [];

    sessions.forEach((session) => {
      // Skip sessions with no laps or invalid data
      if (
        !session.laps ||
        !Array.isArray(session.laps) ||
        session.laps.length === 0
      ) {
        return;
      }

      const bestLapTime = Math.min(...session.laps);
      const lapNumber = session.laps.indexOf(bestLapTime) + 1;

      // Only add if we have valid driver and car names
      if (session.driverName?.trim() && session.carName?.trim()) {
        bestLaps.push({
          sessionId: session.id,
          date: session.date,
          driverName: session.driverName,
          carName: session.carName,
          lapTime: bestLapTime,
          lapNumber: lapNumber,
        });
      }
    });

    // Sort by lap time (fastest first)
    return bestLaps.sort((a, b) => a.lapTime - b.lapTime);
  };

  const BestLapsComparison = ({ sessions }: { sessions: Session[] }) => {
    const [filterDriver, setFilterDriver] = useState<string>("all");
    const [filterCar, setFilterCar] = useState<string>("all");

    const bestLaps = findBestLaps(sessions);

    // Get unique drivers and cars for filters, filtering out empty or undefined values
    const uniqueDrivers = Array.from(
      new Set(
        bestLaps
          .map((lap) => lap.driverName)
          .filter((name) => name && name.trim() !== "")
      )
    );

    const uniqueCars = Array.from(
      new Set(
        bestLaps
          .map((lap) => lap.carName)
          .filter((name) => name && name.trim() !== "")
      )
    );

    // Filter the best laps
    const filteredBestLaps = bestLaps.filter((lap) => {
      if (filterDriver !== "all" && lap.driverName !== filterDriver)
        return false;
      if (filterCar !== "all" && lap.carName !== filterCar) return false;
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
              <Select value={filterDriver} onValueChange={setFilterDriver}>
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
              <Select value={filterCar} onValueChange={setFilterCar}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Cars" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cars</SelectItem>
                  {uniqueCars.map((car) => (
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
                  <th className="p-2 text-right">Date</th>
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
                      {new Date(lap.date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredBestLaps.length === 0 && (
            <div className="text-center py-4 text-muted-foreground">
              No lap times found for the selected filters.
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-semibold mb-2">Lap {label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="text-sm">
              <span style={{ color: entry.color }}>{entry.name}: </span>
              <span className="font-mono">{formatTime(entry.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const handleSessionSelection = (sessionId: string) => {
    setSelectedSessions((prev) => {
      if (prev.includes(sessionId)) {
        return prev.filter((id) => id !== sessionId);
      }
      return [...prev, sessionId];
    });
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

      {/* Driver & Car Selection Card */}
      <Card>
        <CardHeader>
          <CardTitle>Driver & Car Selection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>

      {/* Timer Display */}
      <Card>
        <CardHeader>
          <CardTitle className="text-center text-4xl font-mono">
            {formatTime(currentTime)}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center space-x-4">
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
                  <h3 className="font-semibold mt-4">Lap Times:</h3>
                  {analyzeLaps(currentSession?.laps || laps).map(
                    (lap, index) => (
                      <div
                        key={index}
                        className={`font-mono ${
                          lap.isBest
                            ? "text-green-600 font-bold flex items-center"
                            : ""
                        }`}
                      >
                        Lap {index + 1}: {formatTime(lap.time)}
                        {lap.isBest && (
                          <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                            Best Lap
                          </span>
                        )}
                      </div>
                    )
                  )}
                </div>
                <div>
                  <h3 className="font-semibold">Statistics:</h3>
                  <div className="font-mono">
                    Average:{" "}
                    {formatTime(
                      currentSession
                        ? currentSession.stats.average
                        : calculateStats(laps).average
                    )}
                  </div>
                  <div className="font-mono">
                    Mean:{" "}
                    {formatTime(
                      currentSession
                        ? currentSession.stats.mean
                        : calculateStats(laps).mean
                    )}
                  </div>
                  <div className="font-mono text-green-600 font-bold mt-2">
                    Best Lap:{" "}
                    {formatTime(
                      currentSession
                        ? currentSession.bestLap ??
                            Math.min(...currentSession.laps)
                        : Math.min(...laps)
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Previous Sessions Display */}
      {Array.isArray(savedSessions) && savedSessions.length > 0 && (
        <Card>
          {/* ... CardHeader remains the same ... */}
          <CardContent>
            <div className="space-y-4">
              {savedSessions
                .filter((session) =>
                  currentSession ? session.id !== currentSession.id : true
                )
                .map((session) => (
                  <div
                    key={session.id}
                    className="border-t pt-4 first:border-t-0 first:pt-0"
                  >
                    {/* ... header remains the same ... */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="font-mono mb-2">
                          Driver: {session.driverName}
                        </div>
                        <div className="font-mono mb-2">
                          Car: {session.carName}
                        </div>
                        {analyzeLaps(session.laps).map((lap, index) => (
                          <div
                            key={index}
                            className={`font-mono ${
                              lap.isBest
                                ? "text-green-600 font-bold flex items-center"
                                : ""
                            }`}
                          >
                            Lap {index + 1}: {formatTime(lap.time)}
                            {lap.isBest && (
                              <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                Best Lap
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      <div>
                        <div className="font-mono">
                          Average: {formatTime(session.stats.average)}
                        </div>
                        <div className="font-mono">
                          Mean: {formatTime(session.stats.mean)}
                        </div>
                        <div className="font-mono text-green-600 font-bold mt-2">
                          Best Lap:{" "}
                          {formatTime(
                            session.bestLap ?? Math.min(...session.laps)
                          )}
                        </div>
                      </div>
                    </div>
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
