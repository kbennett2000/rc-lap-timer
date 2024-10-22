'use client';

// 1. Imports
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  PlayCircle, StopCircle, ListPlus, Trash2, 
  Download, Upload, User, Car as CarIcon 
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Driver, Car, Session, LapStats, StoredData } from '@/types/rc-timer';

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
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const [selectedCar, setSelectedCar] = useState<string>('');
  const [newDriverName, setNewDriverName] = useState<string>('');
  const [newCarName, setNewCarName] = useState<string>('');
  const [showNewDriver, setShowNewDriver] = useState<boolean>(false);
  const [showNewCar, setShowNewCar] = useState<boolean>(false);

  // 3. Refs
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 4. Effects
  useEffect(() => {
    try {
      const storedSessions = localStorage.getItem('rc-lap-timer-sessions');
      const storedDrivers = localStorage.getItem('rc-lap-timer-drivers');
      
      if (storedSessions) setSavedSessions(JSON.parse(storedSessions));
      if (storedDrivers) setDrivers(JSON.parse(storedDrivers));
    } catch (error) {
      console.error('Error loading saved data:', error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('rc-lap-timer-sessions', JSON.stringify(savedSessions));
  }, [savedSessions]);

  useEffect(() => {
    localStorage.setItem('rc-lap-timer-drivers', JSON.stringify(drivers));
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
    setSelectedCar('');
  }, [selectedDriver]);

  // 5. Utility Functions
  const formatTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = Math.floor((ms % 1000));
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };

  const calculateStats = (lapTimes: number[]): LapStats => {
    if (lapTimes.length === 0) return { average: 0, mean: 0 };
    const sum = lapTimes.reduce((a, b) => a + b, 0);
    const average = sum / lapTimes.length;
    const sortedLaps = [...lapTimes].sort((a, b) => a - b);
    const mean = sortedLaps[Math.floor(sortedLaps.length / 2)];
    return { average, mean };
  };

  const getCurrentDriverCars = (): Car[] => {
    const driver = drivers.find(d => d.id === selectedDriver);
    return driver ? driver.cars : [];
  };

  // 6. Driver and Car Management
  const addNewDriver = (): void => {
    if (!newDriverName.trim()) return;
    const newDriver: Driver = {
      id: Date.now().toString(),
      name: newDriverName.trim(),
      cars: []
    };
    setDrivers([...drivers, newDriver]);
    setSelectedDriver(newDriver.id);
    setNewDriverName('');
    setShowNewDriver(false);
  };

  const addNewCar = (): void => {
    if (!newCarName.trim() || !selectedDriver) return;
    const newCar: Car = {
      id: Date.now().toString(),
      name: newCarName.trim()
    };
    setDrivers(drivers.map(driver => {
      if (driver.id === selectedDriver) {
        return { ...driver, cars: [...driver.cars, newCar] };
      }
      return driver;
    }));
    setSelectedCar(newCar.id);
    setNewCarName('');
    setShowNewCar(false);
  };

  // 7. Timer Controls
  const startTimer = (): void => {
    if (!selectedDriver || !selectedCar) {
      alert('Please select a driver and car before starting the timer');
      return;
    }
    setStartTime(Date.now());
    setIsRunning(true);
    setLaps([]);
  };

  const recordLap = (): void => {
    if (!isRunning) return;
    const lapTime = currentTime - (laps.length > 0 ? laps.reduce((a, b) => a + b, 0) : 0);
    setLaps([...laps, lapTime]);
  };

  const stopTimer = (): void => {
    if (!isRunning) return;
    const finalLapTime = currentTime - (laps.length > 0 ? laps.reduce((a, b) => a + b, 0) : 0);
    const finalLaps = [...laps, finalLapTime];
    setLaps(finalLaps);
    setIsRunning(false);
    
    const driver = drivers.find(d => d.id === selectedDriver);
    const car = driver?.cars.find(c => c.id === selectedCar);
    
    const newSession: Session = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      driverId: selectedDriver,
      driverName: driver?.name ?? '',
      carId: selectedCar,
      carName: car?.name ?? '',
      laps: finalLaps,
      stats: calculateStats(finalLaps)
    };
    setSavedSessions([newSession, ...savedSessions]);
  };

  // 8. Data Management
  const deleteSession = (sessionId: number): void => {
    setSavedSessions(savedSessions.filter(session => session.id !== sessionId));
    setSessionToDelete(null);
  };

  const clearAllSessions = (): void => {
    setSavedSessions([]);
    setShowClearAllDialog(false);
  };

  const exportData = (): void => {
    const data: StoredData = {
      sessions: savedSessions,
      drivers: drivers
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rc-lap-timer-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result as string) as StoredData;
        if (imported.sessions && imported.drivers) {
          setSavedSessions(imported.sessions);
          setDrivers(imported.drivers);
        }
      } catch (error) {
        console.error('Error importing data:', error);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // 9. Render Component
return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      {/* Driver & Car Selection */}
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
                  {drivers.map(driver => (
                    <SelectItem key={driver.id} value={driver.id}>{driver.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => setShowNewDriver(!showNewDriver)}>
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
                    {getCurrentDriverCars().map(car => (
                      <SelectItem key={car.id} value={car.id}>{car.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => setShowNewCar(!showNewCar)}>
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

      {/* Current Session */}
      {laps.length > 0 && (
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
                    Driver: {drivers.find(d => d.id === selectedDriver)?.name}
                  </div>
                  <div className="font-mono">
                    Car: {getCurrentDriverCars().find(c => c.id === selectedCar)?.name}
                  </div>
                  <h3 className="font-semibold mt-4">Lap Times:</h3>
                  {laps.map((lap, index) => (
                    <div key={index} className="font-mono">
                      Lap {index + 1}: {formatTime(lap)}
                    </div>
                  ))}
                </div>
                <div>
                  <h3 className="font-semibold">Statistics:</h3>
                  <div className="font-mono">
                    Average: {formatTime(calculateStats(laps).average)}
                  </div>
                  <div className="font-mono">
                    Mean: {formatTime(calculateStats(laps).mean)}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Previous Sessions */}
      {savedSessions.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Previous Sessions</CardTitle>
            <div className="flex space-x-2">
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                size="sm"
              >
                <Upload className="mr-2 h-4 w-4" />
                Import
              </Button>
              <Button
                onClick={exportData}
                variant="outline"
                size="sm"
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
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
            <div className="space-y-4">
              {savedSessions.map((session) => (
                <div key={session.id} className="border-t pt-4 first:border-t-0 first:pt-0">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold">{session.date}</h3>
                    <Button 
                      onClick={() => setSessionToDelete(session)}
                      variant="destructive"
                      size="sm"
                      className="bg-red-500 hover:bg-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="font-mono mb-2">
                        Driver: {session.driverName}
                      </div>
                      <div className="font-mono mb-2">
                        Car: {session.carName}
                      </div>
                      {session.laps.map((lap, index) => (
                        <div key={index} className="font-mono">
                          Lap {index + 1}: {formatTime(lap)}
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
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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
      <AlertDialog open={!!sessionToDelete} onOpenChange={() => setSessionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the session from {sessionToDelete?.date}? 
              This action cannot be undone.
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
      <AlertDialog open={showClearAllDialog} onOpenChange={setShowClearAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Sessions</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all saved sessions? 
              This action cannot be undone.
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
