// src/components/racing-session/race-position-board.tsx
import React from "react";
import { Card } from "@/components/ui/card";
import { formatTime } from "@/lib/utils";
import { RaceEntryStatus } from "@/types/race-timer";
import { Trophy, Zap, Clock, Flag, AlertTriangle } from "lucide-react";

interface RacePositionBoardProps {
  positions: Array<{
    carNumber: number;
    position: number;
    lapsCompleted: number;
    lastLapTime?: number;
    bestLapTime?: number;
    gap?: number;
    status: RaceEntryStatus;
  }>;
}

export const RacePositionBoard: React.FC<RacePositionBoardProps> = ({ positions }) => {
  if (!Array.isArray(positions)) {
    console.error("Invalid positions prop:", positions);
    return null;
  }

  // Sort positions by actual position number
  const sortedPositions = [...positions].sort((a, b) => a.position - b.position);

  // Find the overall best lap time
  const overallBestLap = Math.min(...positions.map((p) => p.bestLapTime || Infinity).filter((time) => time !== Infinity));

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Position List */}
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4">Race Positions</h3>
          <div className="space-y-2">
            {sortedPositions.map((car) => (
              <div
                key={car.carNumber}
                className={`
                  flex items-center justify-between p-2 rounded-lg
                  ${car.status === "DNF" ? "bg-red-100" : "bg-gray-100"}
                  ${car.position === 1 ? "border-l-4 border-yellow-400" : ""}
                `}
              >
                {/* Position and Car Info */}
                <div className="flex items-center space-x-3">
                  <span className="font-bold text-lg min-w-[2rem]">{car.status === "DNF" ? "DNF" : `P${car.position}`}</span>
                  <div>
                    <div className="font-semibold">{car.driverName}</div>
                    <div className="text-sm text-gray-600">Car #{car.carNumber}</div>
                  </div>
                </div>

                {/* Timing Info */}
                <div className="text-right">
                  <div className="flex items-center justify-end space-x-2">
                    <Clock className="h-4 w-4" />
                    <span>{car.lastLapTime ? formatTime(car.lastLapTime) : "--:--:--"}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    Laps: {car.lapsCompleted}
                    {car.gap !== undefined && car.position > 1 && !car.status.includes("DNF") && <span className="ml-2">Gap: {formatTime(car.gap)}</span>}
                  </div>
                </div>

                {/* Status Indicators */}
                <div className="flex flex-col items-center ml-2">
                  {car.bestLapTime === overallBestLap && <Zap className="h-4 w-4 text-purple-500" />}
                  {car.status === "FINISHED" && <Flag className="h-4 w-4 text-green-500" />}
                  {car.status === "DNF" && <AlertTriangle className="h-4 w-4 text-red-500" />}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Best Laps Panel */}
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4">Best Lap Times</h3>
          <div className="space-y-2">
            {sortedPositions
              .filter((car) => car.bestLapTime)
              .sort((a, b) => (a.bestLapTime || 0) - (b.bestLapTime || 0))
              .map((car, index) => (
                <div
                  key={car.carNumber}
                  className={`
                    flex items-center justify-between p-2 rounded-lg bg-gray-100
                    ${index === 0 ? "border-l-4 border-purple-400" : ""}
                  `}
                >
                  <div className="flex items-center space-x-3">
                    <span className="font-bold">Car #{car.carNumber}</span>
                    <span>{car.driverName}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {index === 0 && <Trophy className="h-4 w-4 text-purple-500" />}
                    <span className="font-mono">{car.bestLapTime && formatTime(car.bestLapTime)}</span>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center space-x-4 text-sm text-gray-600">
        <div className="flex items-center space-x-1">
          <Trophy className="h-4 w-4 text-purple-500" />
          <span>Best Lap</span>
        </div>
        <div className="flex items-center space-x-1">
          <Flag className="h-4 w-4 text-green-500" />
          <span>Finished</span>
        </div>
        <div className="flex items-center space-x-1">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span>DNF</span>
        </div>
      </div>
    </div>
  );
};
