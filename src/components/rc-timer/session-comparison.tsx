"use client";

import { formatTime, formatDateTime } from "@/lib/utils";
import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Session } from "@/types/rc-timer";

interface ComparisonData {
  lap: number;
  [key: string]: number | null;
}

export function SessionComparison({ sessions }: { sessions: Session[] }) {
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);

  // Add this function to handle session selection
  const handleSessionSelection = (sessionId: string) => {
    setSelectedSessions((prev) => {
      if (prev.includes(sessionId)) {
        // If already selected, remove it
        return prev.filter((id) => id !== sessionId);
      } else {
        // If not selected, add it
        return [...prev, sessionId];
      }
    });
  };

  // Simplified data preparation
  const prepareChartData = () => {
    // Get selected session objects
    const selectedSessionsData = selectedSessions
      .map((id) => sessions.find((s) => s.id.toString() === id))
      .filter((s): s is Session => s !== undefined);

    // Find maximum number of laps
    const maxLaps = Math.max(
      ...selectedSessionsData.map((session) => session.laps.length)
    );

    // Create data points
    return Array.from({ length: maxLaps }, (_, i) => {
      const dataPoint: any = { lap: i + 1 };

      // Add lap times for each session
      selectedSessionsData.forEach((session) => {
        const key = `Session ${session.id}`;
        dataPoint[key] = i < session.laps.length ? session.laps[i] : null;
      });

      return dataPoint;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session Comparison</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Session Selection */}
        <div className="space-y-2">
          <Label>
            Select Sessions to Compare (Selected: {selectedSessions.length})
          </Label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors
                  ${
                    selectedSessions.includes(session.id.toString())
                      ? "border-blue-500 bg-blue-50"
                      : "hover:bg-gray-50"
                  }`}
                onClick={() => handleSessionSelection(session.id.toString())}
              >
                <div className="font-medium">{session.driverName}</div>
                <div className="text-sm text-muted-foreground">
                  {session.carName}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatDateTime(session.date)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedSessions.length > 0 && (
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={prepareChartData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="lap"
                  label={{ value: "Lap Number", position: "bottom" }}
                />
                <YAxis
                  label={{
                    value: "Time (seconds)",
                    angle: -90,
                    position: "insideLeft",
                  }}
                  tickFormatter={(value) => (value / 1000).toFixed(1)}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white p-3 border rounded-lg shadow-lg">
                          <p className="font-semibold mb-2">Lap {label}</p>
                          {payload.map((entry: any, index: number) => (
                            <div key={index} className="text-sm">
                              <span style={{ color: entry.color }}>
                                {entry.name}
                              </span>
                              <span className="font-mono ml-2">
                                {formatTime(entry.value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                {selectedSessions.map((sessionId, index) => {
                  const session = sessions.find(
                    (s) => s.id.toString() === sessionId
                  );
                  if (!session) return null;

                  const key = `Session ${session.id}`;
                  return (
                    <Line
                      key={session.id}
                      name={`${session.driverName} - ${session.carName}`}
                      type="monotone"
                      dataKey={key}
                      stroke={getLineColors(index)}
                      dot={true}
                      strokeWidth={2}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Color function
function getLineColors(index: number): string {
  const colors = [
    "#2563eb", // blue
    "#dc2626", // red
    "#16a34a", // green
    "#9333ea", // purple
    "#ea580c", // orange
    "#0891b2", // cyan
  ];
  return colors[index % colors.length];
}
