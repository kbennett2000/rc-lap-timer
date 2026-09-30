"use client";

import { useState } from "react";
import { Car as CarIcon, MapPin, PlayCircle, User, Video } from "lucide-react";
import { canPlayThroughSilentSwitch, setPlayThroughSilentSwitch } from "@/audio";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Driver, Location } from "@/domain/types";
import { CAPABILITIES } from "@/platform/capabilities";
import type { LapTarget, TimingMode } from "@/timing/engine";
import { AddEntityDialog, type CreatedEntity, type EntityType } from "./add-entity-dialog";
import type { SoundSettings } from "./run-sounds";

export interface Selection {
  driverId: string;
  carId: string;
  locationId: string;
  lapTarget: LapTarget;
  timingMode: TimingMode;
}

interface SessionSetupProps {
  drivers: Driver[];
  locations: Location[];
  selection: Selection;
  onSelectionChange: (change: Partial<Selection>) => void;
  sounds: SoundSettings;
  onSoundsChange: (change: Partial<SoundSettings>) => void;
  remoteControl: boolean;
  onRemoteControlChange: (enabled: boolean) => void;
  // Called inside the tap that picks a timing mode (IR timing starts on its own, so this is its only tap).
  onTimingModeTap: (mode: TimingMode) => void;
  locked: boolean;
  onCreated: (created: CreatedEntity) => void;
}

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);

// Announcements, remote control, driver/car/location, lap count and timing mode. Locked while a run is going.
export function SessionSetup({
  drivers,
  locations,
  selection,
  onSelectionChange,
  sounds,
  onSoundsChange,
  remoteControl,
  onRemoteControlChange,
  onTimingModeTap,
  locked,
  onCreated,
}: SessionSetupProps) {
  const [adding, setAdding] = useState<EntityType | null>(null);
  const [customLaps, setCustomLaps] = useState<string | null>(null); // null = not entering a custom count
  const [throughSilentSwitch, setThroughSilentSwitch] = useState(false);

  const driver = drivers.find((d) => d.id === selection.driverId);
  const cars = driver?.cars ?? [];
  const car = cars.find((c) => c.id === selection.carId);
  const location = locations.find((l) => l.id === selection.locationId);
  const hidden = remoteControl ? "hidden" : "";

  const existingNames =
    adding === "driver"
      ? drivers.map((d) => d.name)
      : adding === "car"
        ? cars.map((c) => c.name)
        : locations.map((l) => l.name);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 p-4 bg-gray-50 rounded">
          <h3 className="font-semibold">Announcements</h3>
          <div className="space-y-2">
            <Checkbox
              id="announceLapNumber"
              label="Announce Lap Numbers"
              checked={sounds.announceLapNumber}
              onChange={(checked) => onSoundsChange({ announceLapNumber: checked })}
            />
            <Checkbox
              id="announceLastLapTime"
              label="Announce Last Lap Time"
              checked={sounds.announceLastLapTime}
              onChange={(checked) => onSoundsChange({ announceLastLapTime: checked })}
            />
            <Checkbox
              id="playBeeps"
              label="Play Beeps"
              checked={sounds.beeps}
              onChange={(checked) => onSoundsChange({ beeps: checked })}
            />
            {canPlayThroughSilentSwitch() && (
              <Checkbox
                id="throughSilentSwitch"
                label="Play sounds when the ringer is silenced (pauses other audio)"
                checked={throughSilentSwitch}
                onChange={(checked) => {
                  setThroughSilentSwitch(checked);
                  setPlayThroughSilentSwitch(checked);
                }}
              />
            )}
          </div>
        </div>

        {CAPABILITIES.remoteControl && (
          <div className="flex items-center space-x-2 p-4 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              id="remoteControl"
              checked={remoteControl}
              onChange={(e) => onRemoteControlChange(e.target.checked)}
              disabled={locked}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="remoteControl" className="text-sm font-medium">
              Enable Remote Control Mode
            </label>
            {remoteControl && <div className="ml-2 text-sm text-gray-500">Polling for session requests...</div>}
          </div>
        )}

        <div className={`space-y-2 ${hidden}`}>
          <Label>Driver</Label>
          <div className="flex space-x-2">
            <Select
              value={selection.driverId}
              onValueChange={(driverId) => onSelectionChange({ driverId })}
              disabled={locked}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Driver" />
              </SelectTrigger>
              <SelectContent>
                {[...drivers].sort(byName).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" disabled={locked} onClick={() => setAdding("driver")}>
              <User className="mr-2 h-4 w-4" />
              New Driver
            </Button>
          </div>
        </div>

        {selection.driverId && (
          <div className={`space-y-2 ${hidden}`}>
            <Label>Car</Label>
            <div className="flex space-x-2">
              <Select value={selection.carId} onValueChange={(carId) => onSelectionChange({ carId })} disabled={locked}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Car" />
                </SelectTrigger>
                <SelectContent>
                  {[...cars].sort(byName).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" disabled={locked} onClick={() => setAdding("car")}>
                <CarIcon className="mr-2 h-4 w-4" />
                New Car
              </Button>
            </div>
          </div>
        )}

        {selection.driverId && selection.carId && (
          <div className={`space-y-2 ${hidden}`}>
            <Label>Location</Label>
            <div className="flex space-x-2">
              <Select
                value={selection.locationId}
                onValueChange={(locationId) => onSelectionChange({ locationId })}
                disabled={locked}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Location" />
                </SelectTrigger>
                <SelectContent>
                  {[...locations].sort(byName).map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" disabled={locked} onClick={() => setAdding("location")}>
                <MapPin className="mr-2 h-4 w-4" />
                New Location
              </Button>
            </div>
          </div>
        )}

        <AddEntityDialog
          type={adding}
          existingNames={existingNames}
          driverId={selection.driverId}
          onClose={() => setAdding(null)}
          onCreated={onCreated}
        />

        <div className={`space-y-2 ${hidden}`}>
          {selection.driverId && selection.carId && (
            <>
              <Label>Number of Laps</Label>
              <Select
                disabled={locked}
                value={customLaps !== null ? "custom" : String(selection.lapTarget)}
                onValueChange={(value) => {
                  if (value === "custom") {
                    setCustomLaps("");
                  } else {
                    setCustomLaps(null);
                    onSelectionChange({ lapTarget: value === "unlimited" ? "unlimited" : parseInt(value, 10) });
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
            </>
          )}

          {customLaps !== null && (
            <div className="flex space-x-2 mt-2">
              <Input
                type="number"
                min="1"
                max="999"
                placeholder="Enter number of laps"
                value={customLaps}
                onChange={(e) => setCustomLaps(e.target.value)}
                disabled={locked}
              />
              <Button
                disabled={locked}
                onClick={() => {
                  const laps = parseInt(customLaps, 10);
                  if (!isNaN(laps) && laps > 0 && laps <= 999) {
                    onSelectionChange({ lapTarget: laps });
                    setCustomLaps(null);
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
            {selection.lapTarget === "unlimited"
              ? "Session will continue until manually stopped"
              : `Session will automatically complete after ${selection.lapTarget} laps`}
          </div>
        </div>

        <div className={`space-y-2 ${hidden}`}>
          <Label>Timing Mode</Label>
          <RadioGroup
            disabled={locked}
            value={selection.timingMode}
            onValueChange={(value) => {
              const timingMode = value as TimingMode;
              onTimingModeTap(timingMode);
              onSelectionChange({ timingMode });
            }}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="manual" id="timing-ui" />
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
            {CAPABILITIES.irTiming && (
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ir" id="timing-ir" />
                <Label htmlFor="timing-ir" className="flex items-center">
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Time Using IR
                </Label>
              </div>
            )}
          </RadioGroup>
        </div>

        {driver && car && location && (
          <div className="mt-4 p-4 bg-muted/50 rounded-lg">
            <h3 className="font-semibold mb-2">Session Settings</h3>
            <div className="space-y-1 text-sm">
              <div>Driver: {driver.name}</div>
              <div>Car: {car.name}</div>
              <div>Location: {location.name}</div>
              <div>Laps: {selection.lapTarget === "unlimited" ? "Unlimited" : selection.lapTarget}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Checkbox({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center space-x-2">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300"
      />
      <label htmlFor={id} className="text-sm">
        {label}
      </label>
    </div>
  );
}
