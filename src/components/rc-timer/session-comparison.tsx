"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Session, ComparisonData } from "@/types/rc-timer";
import { cn } from "@/lib/utils";
import { formatTime, formatDateTime } from "@/lib/utils";

interface SessionComparisonProps {
  sessions: Session[];
}

// In session-comparison.tsx
export function SessionComparison({ sessions }: { sessions: Session[] }) {
  console.log("SessionComparison received sessions:", sessions);

  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [filterDriver, setFilterDriver] = useState<string>("all");
  const [filterCar, setFilterCar] = useState<string>("all");

  // Add useEffect to log when sessions or selections change
  useEffect(() => {
    console.log("Sessions or selections changed:", {
      availableSessions: sessions,
      selectedSessions,
      selectedSessionsCount: selectedSessions.length,
    });
  }, [sessions, selectedSessions]);

  // Debug logs
  console.log("Available sessions:", sessions);
  console.log("Selected sessions:", selectedSessions);

  // Get unique drivers from sessions
  const getUniqueDrivers = () => {
    const drivers = new Set(sessions.map((session) => session.driverName));
    return Array.from(drivers)
      .filter((name) => name && name.trim() !== "")
      .sort((a, b) => a.localeCompare(b));
  };

  // Get cars for selected driver
  const getDriverCars = (driverName: string) => {
    const driverSessions = sessions.filter((session) => session.driverName === driverName);
    const cars = new Set(driverSessions.map((session) => session.carName));
    return Array.from(cars)
      .filter((name) => name && name.trim() !== "")
      .sort((a, b) => a.localeCompare(b));
  };

  // Prepare data for the chart
  const prepareChartData = () => {
    console.log("Preparing chart data for sessions:", selectedSessions);

    const selectedSessionData = selectedSessions.map((id) => sessions.find((s) => s.id === id)).filter((s): s is Session => s !== undefined);

    console.log("Selected session data:", selectedSessionData);

    if (selectedSessionData.length === 0) return [];

    const maxLaps = Math.max(...selectedSessionData.map((s) => s.laps.length));

    return Array.from({ length: maxLaps }, (_, i) => {
      const dataPoint: ComparisonData = {
        lap: i + 1,
      };

      selectedSessionData.forEach((session) => {
        const sessionDate = new Date(session.date);
        const formattedDate = sessionDate.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        const sessionKey = `${session.driverName} - ${session.carName} (${formattedDate})`;

        const lap = session.laps.find((l) => l.lapNumber === i + 1);
        dataPoint[sessionKey] = lap ? lap.lapTime : null;
      });

      return dataPoint;
    });
  };

  const chartData = prepareChartData();
  console.log("Chart data:", chartData);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Session Selection */}
        <div className="space-y-2">
          {console.log("Rendering session list, count:", sessions.length)}
          <Label>Select Sessions to Compare</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((session) => {
              console.log("Rendering session card:", session);
              return (
                <div
                  key={session.id}
                  className={cn("p-3 rounded-lg border cursor-pointer transition-colors", selectedSessions.includes(session.id) ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50")}
                  onClick={() => {
                    console.log("Session clicked:", session.id);
                    setSelectedSessions((prev) => {
                      if (prev.includes(session.id)) {
                        return prev.filter((id) => id !== session.id);
                      }
                      return [...prev, session.id];
                    });
                  }}
                >
                  <div className="font-medium">{session.driverName}</div>
                  <div className="text-sm text-muted-foreground">{session.carName}</div>
                  <div className="text-sm text-muted-foreground">{formatDateTime(session.date)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Comparison Chart */}
        {selectedSessions.length > 0 && chartData.length > 0 && (
          <div className="h-[400px] mt-8">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="lap"
                  label={{
                    value: "Lap Number",
                    position: "insideBottom",
                    offset: -5,
                  }}
                />
                <YAxis
                  label={{
                    value: "Lap Time (s)",
                    angle: -90,
                    position: "insideLeft",
                  }}
                  tickFormatter={(value) => formatTime(value)}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white p-3 border rounded-lg shadow-lg">
                          <p className="font-semibold mb-2">Lap {label}</p>
                          {payload.map((entry: any, index: number) => (
                            <div key={index} className="text-sm">
                              <span style={{ color: entry.color }}>{entry.name}</span>
                              <span className="font-mono ml-2">{formatTime(entry.value)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                {Object.keys(chartData[0] || {})
                  .filter((key) => key !== "lap")
                  .map((sessionKey, index) => (
                    <Line key={sessionKey} type="monotone" dataKey={sessionKey} stroke={`hsl(${index * 60}, 70%, 50%)`} strokeWidth={2} dot={{ r: 4 }} connectNulls />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
