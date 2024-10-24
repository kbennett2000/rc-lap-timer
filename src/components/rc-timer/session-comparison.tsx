"use client";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Session } from "@/types/rc-timer";
import { formatDateTime, formatTime } from "@/lib/utils";
import {
  addDays,
  format,
  isBefore,
  isAfter,
  startOfDay,
  endOfDay,
  parseISO,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";

interface ComparisonData {
  lap: number;
  [key: string]: number | null;
}

export function SessionComparison({ sessions }: { sessions: Session[] }) {
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [filterDriver, setFilterDriver] = useState<string>("all");
  const [filterCar, setFilterCar] = useState<string>("all");
  const [chartData, setChartData] = useState<ComparisonData[]>([]);

  // Update chart data when selections change
  useEffect(() => {
    const data = prepareChartData();
    console.log("Chart data prepared:", data);
    setChartData(data);
  }, [selectedSessions]);

  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });

  // Helper function to check if a date is within range
  const isWithinDateRange = (sessionDate: string) => {
    if (!dateRange.from && !dateRange.to) return true;

    const date = parseISO(sessionDate);

    if (dateRange.from && !dateRange.to) {
      return (
        isAfter(date, startOfDay(dateRange.from)) ||
        format(date, "yyyy-MM-dd") === format(dateRange.from, "yyyy-MM-dd")
      );
    }

    if (!dateRange.from && dateRange.to) {
      return (
        isBefore(date, endOfDay(dateRange.to)) ||
        format(date, "yyyy-MM-dd") === format(dateRange.to, "yyyy-MM-dd")
      );
    }

    if (dateRange.from && dateRange.to) {
      return (
        (isAfter(date, startOfDay(dateRange.from)) ||
          format(date, "yyyy-MM-dd") ===
            format(dateRange.from, "yyyy-MM-dd")) &&
        (isBefore(date, endOfDay(dateRange.to)) ||
          format(date, "yyyy-MM-dd") === format(dateRange.to, "yyyy-MM-dd"))
      );
    }

    return true;
  };

  const prepareChartData = (): ComparisonData[] => {
    // Get selected session objects
    const selectedSessionData = selectedSessions
      .map((id) => sessions.find((s) => s.id.toString() === id))
      .filter((s): s is Session => s !== undefined);

    console.log("Selected sessions:", selectedSessionData);

    if (selectedSessionData.length === 0) return [];

    // Find maximum number of laps
    const maxLaps = Math.max(...selectedSessionData.map((s) => s.laps.length));

    // Create data points
    const data = Array.from({ length: maxLaps }, (_, i) => {
      const dataPoint: ComparisonData = {
        lapNumber: i + 1,
      };

      // Add lap times for each session with unique keys
      selectedSessionData.forEach((session) => {
        // Create a unique key including the date
        const sessionDate = new Date(session.date);
        const formattedDate = sessionDate.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        const sessionKey = `${session.driverName} - ${session.carName} (${formattedDate})`;
        dataPoint[sessionKey] =
          i < session.laps.length ? session.laps[i] : null;
      });

      return dataPoint;
    });

    console.log("Generated chart data:", data);
    return data;
  };

  // Handle session selection
  const handleSessionSelect = (sessionId: string) => {
    console.log("Session selected:", sessionId);
    setSelectedSessions((prev) => {
      const newSelection = prev.includes(sessionId)
        ? prev.filter((id) => id !== sessionId)
        : [...prev, sessionId];
      console.log("New selection:", newSelection);
      return newSelection;
    });
  };

  // Get unique drivers from sessions
  const getUniqueDrivers = () => {
    const drivers = new Set(sessions.map((session) => session.driverName));
    return Array.from(drivers);
  };

  // Get cars for selected driver
  const getDriverCars = (driverName: string) => {
    const driverSessions = sessions.filter(
      (session) => session.driverName === driverName
    );
    const cars = new Set(driverSessions.map((session) => session.carName));
    return Array.from(cars);
  };

  // Reset car filter when driver changes
  useEffect(() => {
    setFilterCar("all");
  }, [filterDriver]);

  // Filter sessions based on selected driver and car
  const getFilteredSessions = () => {
    return sessions.filter((session) => {
      if (filterDriver !== "all" && session.driverName !== filterDriver)
        return false;
      if (filterCar !== "all" && session.carName !== filterCar) return false;
      if (!isWithinDateRange(session.date)) return false;
      return true;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session Comparison</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters Section */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Driver Filter */}
            <div className="space-y-2">
              <Label>Filter by Driver</Label>
              <Select
                value={filterDriver}
                onValueChange={(value) => {
                  setFilterDriver(value);
                  setSelectedSessions([]); // Clear selections when filter changes
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

            {/* Car Filter */}
            <div className="space-y-2">
              <Label>Filter by Car</Label>
              <Select
                value={filterCar}
                onValueChange={(value) => {
                  setFilterCar(value);
                  setSelectedSessions([]); // Clear selections when filter changes
                }}
                disabled={filterDriver === "all"}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      filterDriver === "all"
                        ? "Select a driver first"
                        : "All Cars"
                    }
                  />
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

            {/* Date Range Filter */}
            <div className="space-y-2">
              <Label>Filter by Date Range</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full sm:w-[240px] justify-start text-left font-normal",
                        !dateRange.from && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.from
                        ? format(dateRange.from, "PPP")
                        : "Select start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateRange.from}
                      onSelect={(date) =>
                        setDateRange((prev) => ({ ...prev, from: date }))
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full sm:w-[240px] justify-start text-left font-normal",
                        !dateRange.to && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.to
                        ? format(dateRange.to, "PPP")
                        : "Select end date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateRange.to}
                      onSelect={(date) =>
                        setDateRange((prev) => ({ ...prev, to: date }))
                      }
                      disabled={(date) =>
                        dateRange.from ? isBefore(date, dateRange.from) : false
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Button
                  variant="outline"
                  onClick={() =>
                    setDateRange({ from: undefined, to: undefined })
                  }
                  className="w-full sm:w-auto"
                >
                  Reset Dates
                </Button>
              </div>

              {/* Date Range Summary */}
              {(dateRange.from || dateRange.to) && (
                <div className="text-sm text-muted-foreground">
                  Showing sessions
                  {dateRange.from &&
                    !dateRange.to &&
                    ` from ${format(dateRange.from, "PPP")}`}
                  {!dateRange.from &&
                    dateRange.to &&
                    ` until ${format(dateRange.to, "PPP")}`}
                  {dateRange.from &&
                    dateRange.to &&
                    ` from ${format(dateRange.from, "PPP")} to ${format(
                      dateRange.to,
                      "PPP"
                    )}`}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Session Selection */}
        <div className="space-y-2">
          <Label>
            Select Sessions to Compare (Selected: {selectedSessions.length})
          </Label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getFilteredSessions().map((session) => (
              <div
                key={session.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors
                  ${
                    selectedSessions.includes(session.id.toString())
                      ? "border-blue-500 bg-blue-50"
                      : "hover:bg-gray-50"
                  }`}
                onClick={() => handleSessionSelect(session.id.toString())}
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

        {/* Chart Section */}
        {selectedSessions.length > 0 && chartData.length > 0 && (
          <div className="h-[400px] mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="lapNumber"
                  label={{ value: "Lap Number", position: "bottom" }}
                />
                <YAxis
                  label={{
                    value: "Lap Time",
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
                              <span style={{ color: entry.color }}>
                                {entry.name}:
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

                  const sessionDate = new Date(session.date);
                  const formattedDate = sessionDate.toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const sessionKey = `${session.driverName} - ${session.carName} (${formattedDate})`;

                  console.log("Adding line for session:", sessionKey);

                  return (
                    <Line
                      key={sessionId}
                      type="monotone"
                      dataKey={sessionKey}
                      name={sessionKey}
                      stroke={getLineColor(index)}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 8 }}
                      connectNulls={false}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {chartData.length === 0 && selectedSessions.length > 0 && (
          <div className="text-center py-4 text-muted-foreground">
            No lap data available for the selected sessions.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const getLineColor = (index: number): string => {
  const colors = [
    "#2563eb", // blue
    "#dc2626", // red
    "#16a34a", // green
    "#9333ea", // purple
    "#ea580c", // orange
    "#0891b2", // cyan
  ];
  return colors[index % colors.length];
};
