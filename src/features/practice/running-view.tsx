"use client";

import { useEffect, useState, type ReactNode } from "react";
import { MonitorSmartphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLapTime } from "@/domain/format";
import { cn } from "@/lib/utils";
import { now } from "@/timing/clock";
import { currentLapElapsed, currentLapNumber, elapsed, gapTotal, type Run } from "@/timing/engine";

// The current time, updated every frame while `live`. Only the small components that show a clock use it, so the
// rest of the screen doesn't re-render as time passes.
function useFrameClock(live: boolean): number {
  const [time, setTime] = useState(now);
  useEffect(() => {
    if (!live) return;
    let frame = requestAnimationFrame(function tick() {
      setTime(now());
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [live]);
  return time;
}

function TotalTime({ run, live }: { run: Run; live: boolean }) {
  const time = useFrameClock(live && run.status === "running");
  return <>{formatLapTime(elapsed(run, time))}</>;
}

function CurrentLapTime({ run, live }: { run: Run; live: boolean }) {
  const time = useFrameClock(live && run.status === "running");
  return <>{formatLapTime(currentLapElapsed(run, time))}</>;
}

function lapCounter(run: Run): string {
  if (run.status === "idle") return "Ready";
  if (run.status === "finished") return "Timing Session Finished";
  const lap = currentLapNumber(run);
  return run.config.lapTarget === "unlimited" ? `Lap: ${lap}` : `Lap: ${lap} of ${run.config.lapTarget}`;
}

interface RunningViewProps {
  run: Run;
  // False while the Practice tab is hidden, to stop the clock updates.
  visible: boolean;
  screenKeptOn: boolean;
  wakeLockSupported: boolean;
  children: ReactNode;
}

export function RunningView({ run, visible, screenKeptOn, wakeLockSupported, children }: RunningViewProps) {
  const running = run.status === "running";
  const gapSeconds = Math.round(gapTotal(run, now()) / 1000);

  return (
    <Card>
      <CardHeader>
        <CardTitle className={cn("text-center text-5xl font-mono transition-all", running && "animate-time-pulse")}>
          <TotalTime run={run} live={visible} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center text-2xl font-mono text-gray-600">
          Current Lap: <CurrentLapTime run={run} live={visible} />
        </div>

        <div className="text-xl font-mono text-center">{lapCounter(run)}</div>

        {running && (screenKeptOn || !wakeLockSupported) && (
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <MonitorSmartphone className="h-3 w-3" />
            {screenKeptOn ? "Screen stays on" : "Keep the screen on yourself: this browser can't do it for you"}
          </div>
        )}

        {run.status !== "idle" && gapSeconds > 0 && (
          <div className="rounded bg-yellow-50 p-2 text-center text-sm text-yellow-800">
            The screen was off for {gapSeconds} s; laps in that time may be missing.
          </div>
        )}

        {children}
      </CardContent>
    </Card>
  );
}
