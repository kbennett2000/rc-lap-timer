// src/components/racing-session/race-config-form.tsx
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Car, Driver, Location } from "@prisma/client";
import { format } from "date-fns";

interface RaceConfigFormProps {
  onConfigured: (config: {
    name: string;
    locationId: string;
    startDelay: number;
    totalLaps?: number;
    entries: Array<{
      driverId: string;
      carId: string;
      carNumber: number;
    }>;
  }) => void;
  startDelay: number;
  onStartDelayChange: (delay: number) => void;
  totalLaps: number | "unlimited";
  onTotalLapsChange: (laps: number | "unlimited") => void;
  playBeeps: boolean;
  onPlayBeepsChange: (play: boolean) => void;
  voiceAnnouncements: boolean;
  onVoiceAnnouncementsChange: (enable: boolean) => void;
}

export const RaceConfigForm: React.FC<RaceConfigFormProps> = ({ onConfigured, startDelay, onStartDelayChange, totalLaps, onTotalLapsChange, playBeeps, onPlayBeepsChange, voiceAnnouncements, onVoiceAnnouncementsChange }) => {
  const [selectedLocation, setSelectedLocation] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [customLaps, setCustomLaps] = useState("");
  const [showCustomLaps, setShowCustomLaps] = useState(false);
  const [usedDrivers, setUsedDrivers] = useState<Set<string>>(new Set());

  const [carAssignments, setCarAssignments] = useState<
    Array<{
      driverId: string;
      carId: string;
      carNumber: string;
    }>
  >([{ driverId: "", carId: "", carNumber: "" }]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/data");
        const data = await response.json();
        setLocations(data.locations);
        setDrivers(data.drivers);
      } catch (error) {
        console.error("Error loading data:", error);
      }
    };
    fetchData();
  }, []);

  const getCarsForDriver = (driverId: string): Car[] => {
    const driver = drivers.find((d) => d.id === driverId);
    return driver?.cars || [];
  };

  const getDefaultCarNumber = (carId: string): string => {
    const driver = drivers.find((d) => d.cars.some((c) => c.id === carId));
    const car = driver?.cars.find((c) => c.id === carId);

    if (!car?.defaultCarNumber) return "";

    const carNumber = car.defaultCarNumber.toString();
    const isNumberTaken = carAssignments.some((a) => a.carNumber === carNumber);

    return isNumberTaken ? "" : carNumber;
  };

  const updateCarAssignment = (index: number, field: "driverId" | "carId" | "carNumber", value: string) => {
    const newAssignments = [...carAssignments];

    if (field === "carId") {
      newAssignments[index].carNumber = getDefaultCarNumber(value);
    }

    if (field === "driverId") {
      const oldDriverId = newAssignments[index].driverId;
      if (oldDriverId) {
        const newUsedDrivers = new Set(usedDrivers);
        newUsedDrivers.delete(oldDriverId);
        setUsedDrivers(newUsedDrivers);
      }
      if (value) {
        setUsedDrivers((prev) => new Set(prev).add(value));
      }
      newAssignments[index].carId = "";
      newAssignments[index].carNumber = "";
    }

    newAssignments[index] = {
      ...newAssignments[index],
      [field]: value,
    };

    setCarAssignments(newAssignments);
  };

  const addCarAssignment = () => {
    setCarAssignments([...carAssignments, { driverId: "", carId: "", carNumber: "" }]);
  };

  const removeCarAssignment = (index: number) => {
    const assignment = carAssignments[index];
    if (assignment.driverId) {
      const newUsedDrivers = new Set(usedDrivers);
      newUsedDrivers.delete(assignment.driverId);
      setUsedDrivers(newUsedDrivers);
    }
    setCarAssignments(carAssignments.filter((_, i) => i !== index));
  };

  const generateRaceName = () => {
    const location = locations.find((l) => l.id === selectedLocation);
    return `${format(new Date(), "yyyyMMdd-HHmm")}-${location?.name || ""}`;
  };

  const isValid = () => {
    if (!selectedLocation) return false;

    const validAssignments = carAssignments.filter((assignment) => assignment.driverId && assignment.carId && assignment.carNumber);

    if (validAssignments.length === 0) return false;

    const carNumbers = validAssignments.map((a) => a.carNumber);
    const uniqueCarNumbers = new Set(carNumbers);
    if (carNumbers.length !== uniqueCarNumbers.size) return false;

    if (showCustomLaps && (!customLaps || isNaN(parseInt(customLaps)) || parseInt(customLaps) < 1)) {
      return false;
    }

    return true;
  };

  const handleSubmit = () => {
    const validEntries = carAssignments
      .filter((assignment) => assignment.driverId && assignment.carId && assignment.carNumber)
      .map((assignment) => ({
        driverId: assignment.driverId,
        carId: assignment.carId,
        carNumber: parseInt(assignment.carNumber),
      }));

    const config = {
      name: generateRaceName(),
      locationId: selectedLocation,
      startDelay,
      totalLaps: showCustomLaps ? parseInt(customLaps) : undefined,
      entries: validEntries,
    };

    onConfigured(config);
  };

  return (
    <div className="space-y-6 max-w-full px-4 md:px-6">
      <div>
        <Label>Location</Label>
        <Select value={selectedLocation} onValueChange={setSelectedLocation}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select location" />
          </SelectTrigger>
          <SelectContent>
            {locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <h3 className="text-lg font-semibold">Car Assignments</h3>
          <Button onClick={addCarAssignment} size="sm" variant="outline">
            Add Car
          </Button>
        </div>

        {carAssignments.map((assignment, index) => (
          <div key={index} className="flex flex-col sm:grid sm:grid-cols-4 gap-4">
            <Select value={assignment.driverId} onValueChange={(value) => updateCarAssignment(index, "driverId", value)} className="w-full">
              <SelectTrigger>
                <SelectValue placeholder="Select driver" />
              </SelectTrigger>
              <SelectContent>
                {drivers
                  .filter((driver) => !usedDrivers.has(driver.id) || driver.id === assignment.driverId)
                  .map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Select value={assignment.carId} onValueChange={(value) => updateCarAssignment(index, "carId", value)} disabled={!assignment.driverId} className="w-full">
              <SelectTrigger>
                <SelectValue placeholder="Select car" />
              </SelectTrigger>
              <SelectContent>
                {getCarsForDriver(assignment.driverId).map((car) => (
                  <SelectItem key={car.id} value={car.id}>
                    {car.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-4">
              <Input
                type="number"
                min="1"
                max="8"
                value={assignment.carNumber}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "" || (parseInt(value) >= 1 && parseInt(value) <= 8)) {
                    updateCarAssignment(index, "carNumber", value);
                  }
                }}
                placeholder="Car #"
                className={`flex-1 ${assignment.carNumber && carAssignments.filter((a) => a.carNumber === assignment.carNumber).length > 1 ? "border-red-500" : ""}`}
              />

              <Button onClick={() => removeCarAssignment(index)} variant="ghost" size="icon" className="text-red-500" disabled={carAssignments.length === 1}>
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Race Settings</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Start Delay (seconds)</Label>
            <Input type="number" min="3" max="30" value={startDelay} onChange={(e) => onStartDelayChange(parseInt(e.target.value))} className="w-full" />
          </div>

          <div>
            <Label>Number of Laps</Label>
            <RadioGroup
              value={showCustomLaps ? "custom" : "unlimited"}
              onValueChange={(value) => {
                setShowCustomLaps(value === "custom");
                if (value !== "custom") {
                  onTotalLapsChange("unlimited");
                }
              }}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="unlimited" id="unlimited" />
                <Label htmlFor="unlimited">Unlimited</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom">Custom</Label>
              </div>
            </RadioGroup>

            {showCustomLaps && (
              <Input
                type="number"
                min="1"
                value={customLaps}
                onChange={(e) => {
                  setCustomLaps(e.target.value);
                  const value = parseInt(e.target.value);
                  if (!isNaN(value) && value > 0) {
                    onTotalLapsChange(value);
                  }
                }}
                placeholder="Enter number of laps"
                className="mt-2 w-full"
              />
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <Label htmlFor="play-beeps">Play Sound Effects</Label>
            <Switch id="play-beeps" checked={playBeeps} onCheckedChange={onPlayBeepsChange} />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <Label htmlFor="voice-announcements">Voice Announcements</Label>
            <Switch id="voice-announcements" checked={voiceAnnouncements} onCheckedChange={onVoiceAnnouncementsChange} />
          </div>
        </div>
      </div>

      <Button onClick={handleSubmit} disabled={!isValid()} className="w-full">
        Start Race Setup
      </Button>
    </div>
  );
};
