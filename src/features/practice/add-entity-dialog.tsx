"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage, useCreateCar, useCreateDriver, useCreateLocation } from "@/data/hooks";
import type { Car, Driver, Location } from "@/domain/types";
import { CAPABILITIES } from "@/platform/capabilities";

export type EntityType = "driver" | "car" | "location";

export type CreatedEntity =
  { type: "driver"; entity: Driver } | { type: "car"; entity: Car } | { type: "location"; entity: Location };

const TITLES: Record<EntityType, string> = { driver: "Driver", car: "Car", location: "Location" };

interface AddEntityDialogProps {
  type: EntityType | null;
  // Names already in use (drivers, this driver's cars, or locations), compared ignoring case.
  existingNames: string[];
  driverId: string;
  onClose: () => void;
  onCreated: (created: CreatedEntity) => void;
}

// Adds a driver, a car for the selected driver, or a location, from the practice setup.
export function AddEntityDialog({ type, existingNames, driverId, onClose, onCreated }: AddEntityDialogProps) {
  const [name, setName] = useState("");
  const [defaultCarNumber, setDefaultCarNumber] = useState<number | undefined>();
  const createDriver = useCreateDriver();
  const createCar = useCreateCar();
  const createLocation = useCreateLocation();

  const trimmed = name.trim();
  const duplicate = trimmed !== "" && existingNames.some((n) => n.toLowerCase().trim() === trimmed.toLowerCase());

  const close = () => {
    setName("");
    setDefaultCarNumber(undefined);
    onClose();
  };

  const create = async () => {
    if (!type || !trimmed || duplicate) return;
    if (type === "car" && !driverId) {
      alert("Please select a driver first");
      return;
    }
    const carNumber = defaultCarNumber ?? null;
    close();
    try {
      if (type === "driver") onCreated({ type, entity: await createDriver.mutateAsync(trimmed) });
      else if (type === "car") {
        const car = await createCar.mutateAsync({ driverId, name: trimmed, defaultCarNumber: carNumber });
        onCreated({ type, entity: car });
      } else onCreated({ type, entity: await createLocation.mutateAsync(trimmed) });
    } catch (error) {
      alert(`Failed to create the ${type}. ${errorMessage(error)}`);
    }
  };

  return (
    <AlertDialog open={type !== null} onOpenChange={(open) => !open && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Add New {type ? TITLES[type] : ""}</AlertDialogTitle>
          <AlertDialogDescription>Enter a name for the new {type}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Enter ${type} name`}
            className={duplicate ? "border-red-500" : ""}
          />

          {type === "car" && (CAPABILITIES.irTiming || CAPABILITIES.races) && (
            <div className="space-y-2">
              <Label>Default IR Car Number (Optional)</Label>
              <Input
                type="number"
                min="1"
                max="8"
                value={defaultCarNumber ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "") setDefaultCarNumber(undefined);
                  else if (parseInt(value) >= 1 && parseInt(value) <= 8) setDefaultCarNumber(parseInt(value));
                }}
                placeholder="Enter default car number (1-8)"
              />
            </div>
          )}

          {duplicate && (
            <p className="text-sm text-red-500 mt-2">
              {type === "car" ? "This car name already exists for this driver" : `This ${type} name already exists`}
            </p>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={create} disabled={!trimmed || duplicate}>
            Add
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
