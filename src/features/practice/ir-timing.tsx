"use client";

import { useEffect } from "react";
import { StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLatest } from "@/hooks/use-latest";
import { logger } from "@/lib/logger";
import { now } from "@/timing/clock";

const POLL_MS = 25;
const RETRY_MS = 1000; // after a failed request, e.g. the IR service isn't running
const COOLDOWN_MS = 5000; // ignore the same car for this long after a crossing

interface IrTimingProps {
  // The car's IR beacon number (its default car number).
  carNumber: string;
  running: boolean;
  onCarDetected: (at: number) => void;
  onStop: () => void;
}

// IR timing on the Pi: polls the IR service for beacons in view. A car counts when its beacon appears after being
// out of view, at most once per cooldown. One request at a time.
export function IrTiming({ carNumber, running, onCarDetected, onStop }: IrTimingProps) {
  const latest = useLatest({ carNumber, onCarDetected });

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let inView = new Set<string>();
    let cooldownUntil = 0;
    let failing = false;

    const poll = async () => {
      let delay = POLL_MS;
      try {
        const response = await fetch("/api/ir/current_cars");
        if (!response.ok) throw new Error(`IR service returned ${response.status}`);
        const cars: { id: string }[] = await response.json();
        const at = now();
        const target = latest.current.carNumber;
        const nowInView = new Set(cars.map((car) => String(car.id)));
        if (target && nowInView.has(target) && !inView.has(target) && at >= cooldownUntil) {
          cooldownUntil = at + COOLDOWN_MS;
          latest.current.onCarDetected(at);
        }
        inView = nowInView;
        failing = false;
      } catch (error) {
        if (!failing) logger.warn("IR detection unavailable:", error);
        failing = true;
        delay = RETRY_MS;
      } finally {
        if (!stopped) timer = setTimeout(poll, delay);
      }
    };

    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [latest]);

  return (
    <div className="flex flex-col gap-2">
      {running && (
        <Button onClick={onStop} className="mt-4 w-full bg-red-500 hover:bg-red-600">
          <StopCircle className="mr-2 h-6 w-6" />
          Stop Timer
        </Button>
      )}
      <p>IR Detection Mode{carNumber ? ` (car ${carNumber})` : ": give this car a default car number to use IR"}</p>
    </div>
  );
}
