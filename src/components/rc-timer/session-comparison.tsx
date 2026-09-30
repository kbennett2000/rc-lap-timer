"use client";

import { isWithinRange, todayRange, type DateRange } from "@/domain/date-range";
import { DateRangeFilter } from "@/features/history/date-range-filter";
import { useState, useEffect, useMemo } from "react";
import { formatDateTime, formatLapTime } from "@/domain/format";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Session, ComparisonData } from "@/types/rc-timer";
import { cn } from "@/lib/utils";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart2, Search } from "lucide-react";

interface SessionComparisonProps {
  sessions: Session[];
}

export function SessionComparison({ sessions }: SessionComparisonProps) {
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [filterDriver, setFilterDriver] = useState<string>("all");
  const [filterCar, setFilterCar] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange>(() => todayRange());

  const prepareChartData = () => {
    const selectedSessionData = selectedSessions
      .map((id) => sessions.find((s) => s.id === id))
      .filter((s): s is Session => s !== undefined);

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

  // Calculate chart data whenever selected sessions change
  const chartData = useMemo(() => prepareChartData(), [selectedSessions, sessions]);

  // Add debugging
  useEffect(() => {}, [selectedSessions, chartData]);

  // Get unique drivers sorted alphabetically
  const getUniqueDrivers = () => {
    const drivers = new Set(sessions.map((session) => session.driverName));
    return Array.from(drivers)
      .filter((name) => name && name.trim() !== "")
      .sort((a, b) => a.localeCompare(b));
  };

  // Get cars for selected driver sorted alphabetically
  const getDriverCars = (driverName: string) => {
    const driverSessions = sessions.filter((session) => session.driverName === driverName);
    const cars = new Set(driverSessions.map((session) => session.carName));
    return Array.from(cars)
      .filter((name) => name && name.trim() !== "")
      .sort((a, b) => a.localeCompare(b));
  };

  // Reset car filter when driver changes
  useEffect(() => {
    if (filterDriver === "all") {
      setFilterCar("all");
    }
  }, [filterDriver]);

  // Filter sessions based on all criteria
  const filteredSessions = sessions.filter((session) => {
    // Apply driver filter
    if (filterDriver !== "all" && session.driverName !== filterDriver) return false;

    // Apply car filter
    if (filterCar !== "all" && session.carName !== filterCar) return false;

    // Apply existing date range filter
    if (!isWithinRange(session.date, dateRange)) return false;

    return true;
  });

  const sortSessionsByDate = (sessions: Session[]): Session[] => {
    return [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filters Section */}
        <div className="space-y-4 mb-6">
          {/* Driver and Car Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Filter by Driver</Label>
              <Select
                value={filterDriver}
                onValueChange={(value) => {
                  setFilterDriver(value);
                  if (value === "all") {
                    setFilterCar("all");
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Drivers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Drivers</SelectItem>
                  {getUniqueDrivers().map((driver) => (
                    <SelectItem key={driver} value={driver}>
                      {driver}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Filter by Car</Label>
              <Select value={filterCar} onValueChange={setFilterCar} disabled={filterDriver === "all"}>
                <SelectTrigger>
                  <SelectValue placeholder={filterDriver === "all" ? "Select a driver first" : "All Cars"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cars</SelectItem>
                  {filterDriver !== "all" &&
                    getDriverCars(filterDriver).map((car) => (
                      <SelectItem key={car} value={car}>
                        {car}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </div>

        {sessions.length === 0 ? (
          // No sessions at all
          <div className="text-center py-12">
            <BarChart2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No Sessions to Compare</h3>
            <p className="mt-2 text-sm text-muted-foreground">Record multiple sessions to compare them here.</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          // No sessions match the filters
          <div className="text-center py-12">
            <Search className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No Matching Sessions</h3>
            <p className="mt-2 text-sm text-muted-foreground">Try adjusting your filters to find more sessions.</p>
          </div>
        ) : (
          <>
            {/* Session Selection */}
            <div className="space-y-2">
              <Label>Select Sessions to Compare</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortSessionsByDate(filteredSessions).map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedSessions.includes(session.id) ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50",
                    )}
                    onClick={() => {
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
                ))}
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
                      tickFormatter={(value) => formatLapTime(value)}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white p-3 border rounded-lg shadow-lg">
                              <p className="font-semibold mb-2">Lap {label}</p>
                              {payload.map((entry, index) => (
                                <div key={index} className="text-sm">
                                  <span style={{ color: entry.color }}>{entry.name}</span>
                                  <span className="font-mono ml-2">{formatLapTime(Number(entry.value))}</span>
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
                        <Line
                          key={sessionKey}
                          type="monotone"
                          dataKey={sessionKey}
                          stroke={`hsl(${index * 60}, 70%, 50%)`}
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          connectNulls
                        />
                      ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
