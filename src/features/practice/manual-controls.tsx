"use client";

import { useState } from "react";
import { AlertTriangle, ListPlus, PlayCircle, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ManualControlsProps {
  running: boolean;
  canStart: boolean;
  onStart: () => void;
  onLap: () => void;
  onStop: () => void;
  onPenalty: () => void;
}

// Tap timing: Record Lap when the car crosses the line; Stop Lap Timer records the final crossing and ends.
export function ManualControls({ running, canStart, onStart, onLap, onStop, onPenalty }: ManualControlsProps) {
  const [animation, setAnimation] = useState<string | null>(null);
  const animate = (name: string, ms: number) => {
    setAnimation(name);
    setTimeout(() => setAnimation((current) => (current === name ? null : current)), ms);
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={() => {
          animate("start", 500);
          onStart();
        }}
        disabled={running || !canStart}
        className={cn("bg-green-500 hover:bg-green-600 transition-all", animation === "start" && "animate-timer-start")}
      >
        <PlayCircle className="mr-2 h-6 w-6" />
        Start Lap Timer
      </Button>

      <Button
        onClick={() => {
          animate("lap", 300);
          onLap();
        }}
        disabled={!running}
        className={cn("bg-blue-500 hover:bg-blue-600 transition-all", animation === "lap" && "animate-lap-record")}
      >
        <ListPlus className="mr-2 h-6 w-6" />
        Record Lap
      </Button>

      <Button
        onClick={() => {
          animate("stop", 500);
          onStop();
        }}
        disabled={!running}
        className={cn("bg-red-500 hover:bg-red-600 transition-all", animation === "stop" && "animate-timer-stop")}
      >
        <StopCircle className="mr-2 h-6 w-6" />
        Stop Lap Timer
      </Button>

      <Button
        onClick={() => {
          animate("penalty", 300);
          onPenalty();
        }}
        disabled={!running}
        className={cn(
          "bg-yellow-500 hover:bg-yellow-600 transition-all",
          animation === "penalty" && "animate-penalty-add",
        )}
      >
        <AlertTriangle className="mr-2 h-6 w-6" />
        Add Penalty
      </Button>
    </div>
  );
}
