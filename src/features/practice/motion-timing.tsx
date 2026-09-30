"use client";

import { forwardRef } from "react";
import { StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MotionDetector, type MotionDetectorHandle } from "@/components/rc-timer/motion-detector";

interface MotionTimingProps {
  running: boolean;
  soundOn: boolean;
  onCrossing: (at: number) => void;
  onUserStart: () => void;
  onCameraChange: (on: boolean) => void;
  onStop: () => void;
}

// Camera timing: the first detection starts the run and each later one records a lap. Stop Timer ends the run and
// drops the lap in progress (only real crossings count).
export const MotionTiming = forwardRef<MotionDetectorHandle, MotionTimingProps>(function MotionTiming(
  { running, soundOn, onCrossing, onUserStart, onCameraChange, onStop },
  ref,
) {
  return (
    <div className="flex flex-col gap-2">
      {running && (
        <Button onClick={onStop} className="mt-4 w-full bg-red-500 hover:bg-red-600">
          <StopCircle className="mr-2 h-6 w-6" />
          Stop Timer
        </Button>
      )}
      <MotionDetector
        ref={ref}
        onMotionDetected={(_changePercent, at) => onCrossing(at)}
        onUserStart={onUserStart}
        onCameraChange={onCameraChange}
        soundOn={soundOn}
        className="w-full"
      />
    </div>
  );
});
