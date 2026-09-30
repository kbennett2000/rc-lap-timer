"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLapTime } from "@/domain/format";
import { bestLap, lapStats } from "@/domain/stats";
import { lapTimes, type RunningRun } from "@/timing/engine";

// Laps and stats of the run in progress.
export function CurrentRunCard({ run }: { run: RunningRun }) {
  const times = lapTimes(run);
  const best = bestLap(times);
  const stats = lapStats(times, run.penalties);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Current Session</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="font-semibold">Session Info:</h3>
            <div className="font-mono">Driver: {run.config.driverName}</div>
            <div className="font-mono">Car: {run.config.carName}</div>
            <div className="font-mono">Location: {run.config.locationName}</div>
            <h3 className="font-semibold mt-4">Lap Times:</h3>
            {times.map((time, index) => {
              const lapNumber = index + 1;
              const penalties = run.penalties.find((p) => p.lapNumber === lapNumber)?.count ?? 0;
              const isBest = best?.lapNumber === lapNumber;
              return (
                <div
                  key={lapNumber}
                  className={`font-mono ${isBest ? "text-green-600 font-bold flex items-center" : ""}`}
                >
                  Lap {lapNumber}: {formatLapTime(time)}
                  {isBest && (
                    <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Best Lap</span>
                  )}
                  {penalties > 0 && (
                    <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                      {penalties} {penalties === 1 ? "Penalty" : "Penalties"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div>
            <h3 className="font-semibold">Statistics:</h3>
            <div className="font-mono">Average: {formatLapTime(stats.average)}</div>
            <div className="font-mono text-green-600 font-bold mt-2">Best Lap: {formatLapTime(stats.bestLap)}</div>
            <div className="font-mono">Total Penalties: {stats.totalPenalties}</div>
            <div className="font-mono mt-2">Total Time: {formatLapTime(stats.totalTime)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
