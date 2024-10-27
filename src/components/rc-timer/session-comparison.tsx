"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Session, ComparisonData } from "@/types/rc-timer";
import { cn } from "@/lib/utils";
import { formatTime, formatDateTime } from "@/lib/utils";
import { addDays, format, isBefore, isAfter, startOfDay, endOfDay, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, BarChart2 } from "lucide-react";

interface SessionComparisonProps {
  sessions: Session[];
}

export function SessionComparison({ sessions }: SessionComparisonProps) {
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [filterDriver, setFilterDriver] = useState<string>("all");
  const [filterCar, setFilterCar] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>(() => {
    // Default to "Today"
    const today = new Date();
    return {
      from: startOfDay(today),
      to: endOfDay(today),
    };
  });

  // Date range presets
  const DATE_PRESETS = [
    { label: "Today", days: 0 },
    { label: "Last 7 days", days: 7 },
    { label: "Last 30 days", days: 30 },
    { label: "Last 90 days", days: 90 },
    { label: "This month", days: "month" },
    { label: "This year", days: "year" },
  ];

  // Function to get preset dates
  const getPresetDates = (preset: { label: string; days: number | "month" | "year" }) => {
    let from: Date;
    let to = new Date();

    if (preset.days === 0) {
      // Today
      from = startOfDay(new Date());
      to = endOfDay(new Date());
    } else if (preset.days === "month") {
      from = new Date(to.getFullYear(), to.getMonth(), 1);
    } else if (preset.days === "year") {
      from = new Date(to.getFullYear(), 0, 1);
    } else {
      from = new Date(to);
      from.setDate(to.getDate() - preset.days);
    }

    return { from, to };
  };

  // Function to check if a date is within the selected range
  const isWithinDateRange = (sessionDate: string | null): boolean => {
    // If no date range is selected, show all sessions
    if (!dateRange.from && !dateRange.to) return true;

    // If session date is null or invalid, don't show the session
    if (!sessionDate) return false;

    try {
      const date = parseISO(sessionDate);

      if (dateRange.from && !dateRange.to) {
        return isAfter(date, startOfDay(dateRange.from)) || format(date, "yyyy-MM-dd") === format(dateRange.from, "yyyy-MM-dd");
      }

      if (!dateRange.from && dateRange.to) {
        return isBefore(date, endOfDay(dateRange.to)) || format(date, "yyyy-MM-dd") === format(dateRange.to, "yyyy-MM-dd");
      }

      if (dateRange.from && dateRange.to) {
        return (isAfter(date, startOfDay(dateRange.from)) || format(date, "yyyy-MM-dd") === format(dateRange.from, "yyyy-MM-dd")) && (isBefore(date, endOfDay(dateRange.to)) || format(date, "yyyy-MM-dd") === format(dateRange.to, "yyyy-MM-dd"));
      }

      return true;
    } catch (error) {
      console.error("Error parsing date:", error);
      return false;
    }
  };
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
    if (!isWithinDateRange(session.date)) return false;

    return true;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session Comparison</CardTitle>
      </CardHeader>
      <CardContent>
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
          // Your existing content
          <>
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

              {/* Date Range Filters */}
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {DATE_PRESETS.map((preset) => (
                    <Button
                      key={preset.label}
                      variant="outline"
                      size="sm"
                      onClick={() => setDateRange(getPresetDates(preset))}
                      className={cn("text-sm", dateRange.from === getPresetDates(preset).from && dateRange.to === getPresetDates(preset).to ? "bg-primary text-primary-foreground hover:bg-primary/90" : "")}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Custom Date Range */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="grid gap-2">
                  <Label>Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant={"outline"} className={cn("w-[240px] justify-start text-left font-normal", !dateRange.from && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange.from ? format(dateRange.from, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dateRange.from} onSelect={(date) => setDateRange((prev) => ({ ...prev, from: date }))} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="grid gap-2">
                  <Label>End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant={"outline"} className={cn("w-[240px] justify-start text-left font-normal", !dateRange.to && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange.to ? format(dateRange.to, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dateRange.to} onSelect={(date) => setDateRange((prev) => ({ ...prev, to: date }))} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* Session Selection */}
            <div className="space-y-2">
              <Label>Select Sessions to Compare</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    className={cn("p-3 rounded-lg border cursor-pointer transition-colors", selectedSessions.includes(session.id) ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50")}
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
