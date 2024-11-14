// src/components/session-request-form.tsx
import React, { useState } from "react";
import { Driver, Car, Location } from "@/types/rc-timer";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface SessionRequestFormProps {
  drivers: Driver[];
  locations: Location[];
}

export const SessionRequestForm: React.FC<SessionRequestFormProps> = ({ drivers, locations }) => {
  const [selectedDriver, setSelectedDriver] = useState<string>("");
  const [selectedCar, setSelectedCar] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [numberOfLaps, setNumberLaps] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const getCurrentDriverCars = (): Car[] => {
    const driver = drivers.find((d) => d.id === selectedDriver);
    return driver?.cars || [];
  };

  const validateForm = (): boolean => {
    if (!selectedDriver) {
      setFormError("Please select a driver");
      return false;
    }
    if (!selectedCar) {
      setFormError("Please select a car");
      return false;
    }
    if (!selectedLocation) {
      setFormError("Please select a location");
      return false;
    }
    if (!numberOfLaps || isNaN(parseInt(numberOfLaps)) || parseInt(numberOfLaps) <= 0) {
      setFormError("Please enter a valid number of laps");
      return false;
    }
    setFormError(null);
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      const response = await fetch("/api/session-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          driverId: selectedDriver,
          carId: selectedCar,
          locationId: selectedLocation,
          numberOfLaps: parseInt(numberOfLaps),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit session request");
      }

      // Show success message
      toast.success("Session request submitted successfully", {
        description: `Request created for ${drivers.find((d) => d.id === selectedDriver)?.name}`,
      });

      // Reset form
      setSelectedDriver("");
      setSelectedCar("");
      setSelectedLocation("");
      setNumberLaps("");
      setShowConfirmDialog(false);
    } catch (error) {
      logger.error("Error submitting session request:", error);
      toast.error("Failed to submit session request", {
        description: "Please try again later",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <div className="space-y-4">
          {/* Driver Selection */}
          <div className="space-y-2">
            <Label>Driver</Label>
            <Select
              value={selectedDriver}
              onValueChange={(value) => {
                setSelectedDriver(value);
                setSelectedCar(""); // Reset car when driver changes
              }}
            >
              <SelectTrigger>
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
          </div>

          {/* Car Selection */}
          {selectedDriver && (
            <div className="space-y-2">
              <Label>Car</Label>
              <Select value={selectedCar} onValueChange={setSelectedCar}>
                <SelectTrigger>
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
            </div>
          )}

          {/* Location Selection */}
          <div className="space-y-2">
            <Label>Location</Label>
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger>
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
          </div>

          {/* Number of Laps */}
          <div className="space-y-2">
            <Label>Number of Laps</Label>
            <Input type="number" min="1" value={numberOfLaps} onChange={(e) => setNumberLaps(e.target.value)} placeholder="Enter number of laps" />
          </div>

          {formError && (
            <div className="text-red-500 text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {formError}
            </div>
          )}

          {/* Submit Button */}
          <Button onClick={() => setShowConfirmDialog(true)} disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Submitting..." : "Submit Request"}
          </Button>

          {/* Confirmation Dialog */}
          <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm Session Request</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to submit this session request?
                  <div className="mt-4 bg-muted p-4 rounded-lg">
                    <div>Driver: {drivers.find((d) => d.id === selectedDriver)?.name}</div>
                    <div>Car: {getCurrentDriverCars().find((c) => c.id === selectedCar)?.name}</div>
                    <div>Location: {locations.find((l) => l.id === selectedLocation)?.name}</div>
                    <div>Laps: {numberOfLaps}</div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit Request"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
};
