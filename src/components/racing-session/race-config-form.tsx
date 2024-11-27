// src/components/racing-session/race-config-form.tsx
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Car, Driver, Location } from "@prisma/client";

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
  const [raceName, setRaceName] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [customLaps, setCustomLaps] = useState("");
  const [showCustomLaps, setShowCustomLaps] = useState(false);

  // Car number assignments
  const [carAssignments, setCarAssignments] = useState<
    Array<{
      driverId: string;
      carId: string;
      carNumber: string;
    }>
  >(
    [...Array(8)].map(() => ({
      driverId: "",
      carId: "",
      carNumber: "",
    }))
  );

  // Load locations and drivers
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

  // Get cars for a specific driver
  const getCarsForDriver = (driverId: string): Car[] => {
    const driver = drivers.find((d) => d.id === driverId);
    return driver?.cars || [];
  };

  // Handle car assignment updates
  const updateCarAssignment = (index: number, field: "driverId" | "carId" | "carNumber", value: string) => {
    const newAssignments = [...carAssignments];
    newAssignments[index] = {
      ...newAssignments[index],
      [field]: value,
    };

    // If updating driver, reset car selection
    if (field === "driverId") {
      newAssignments[index].carId = "";
    }

    setCarAssignments(newAssignments);
  };

  // Validate form
  const isValid = () => {
    // Must have a race name and location
    if (!raceName.trim() || !selectedLocation) return false;

    // Must have at least one valid car assignment
    const validAssignments = carAssignments.filter((assignment) => assignment.driverId && assignment.carId && assignment.carNumber);

    if (validAssignments.length === 0) return false;

    // Check for duplicate car numbers
    const carNumbers = validAssignments.map((a) => a.carNumber);
    const uniqueCarNumbers = new Set(carNumbers);
    if (carNumbers.length !== uniqueCarNumbers.size) return false;

    // Check for duplicate drivers
    const driverIds = validAssignments.map((a) => a.driverId);
    const uniqueDriverIds = new Set(driverIds);
    if (driverIds.length !== uniqueDriverIds.size) return false;

    // Validate custom laps if set
    if (showCustomLaps && (!customLaps || isNaN(parseInt(customLaps)) || parseInt(customLaps) < 1)) {
      return false;
    }

    return true;
  };

  // Handle form submission
  const handleSubmit = () => {
    console.log("Submitting race config"); // Debug log
    const validEntries = carAssignments
      .filter((assignment) => assignment.driverId && assignment.carId && assignment.carNumber)
      .map((assignment) => ({
        driverId: assignment.driverId,
        carId: assignment.carId,
        carNumber: parseInt(assignment.carNumber),
      }));

    const config = {
      name: raceName.trim(),
      locationId: selectedLocation,
      startDelay,
      totalLaps: showCustomLaps ? parseInt(customLaps) : undefined,
      entries: validEntries,
    };

    onConfigured(config);
  };

  return (
    <div className="space-y-6">
      {/* Race Details */}
      <div className="space-y-4">
        <div>
          <Label>Race Name</Label>
          <Input value={raceName} onChange={(e) => setRaceName(e.target.value)} placeholder="Enter race name" />
        </div>

        <div>
          <Label>Location</Label>
          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger>
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
      </div>

      {/* Car Assignments */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Car Assignments</h3>
        {carAssignments.map((assignment, index) => (
          <div key={index} className="grid grid-cols-3 gap-4">
            <Select value={assignment.driverId} onValueChange={(value) => updateCarAssignment(index, "driverId", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select driver" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((driver) => (
                  <SelectItem key={driver.id} value={driver.id}>
                    {driver.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={assignment.carId} onValueChange={(value) => updateCarAssignment(index, "carId", value)} disabled={!assignment.driverId}>
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
              className={assignment.carNumber && carAssignments.filter((a) => a.carNumber === assignment.carNumber).length > 1 ? "border-red-500" : ""}
            />
          </div>
        ))}
      </div>

      {/* Race Settings */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Race Settings</h3>

        <div>
          <Label>Start Delay (seconds)</Label>
          <Input type="number" min="3" max="30" value={startDelay} onChange={(e) => onStartDelayChange(parseInt(e.target.value))} />
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
              className="mt-2"
            />
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="play-beeps">Play Sound Effects</Label>
            <Switch id="play-beeps" checked={playBeeps} onCheckedChange={onPlayBeepsChange} />
          </div>

          <div className="flex items-center justify-between">
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
