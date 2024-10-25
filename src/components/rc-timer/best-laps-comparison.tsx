"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Session, BestLapRecord } from "@/types/rc-timer";
import { format, isBefore, isAfter, startOfDay, endOfDay, parseISO } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTime, formatDateTime } from "@/lib/utils";

interface DatePreset {
  label: string;
  days: number | "month" | "year";
}

const DATE_PRESETS: DatePreset[] = [
  { label: "Today", days: 0 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "This month", days: "month" },
  { label: "This year", days: "year" },
];

interface BestLapsComparisonProps {
  sessions: Session[];
}

export function BestLapsComparison({ sessions }: BestLapsComparisonProps) {
  const [filterDriver, setFilterDriver] = useState<string>("all");
  const [filterCar, setFilterCar] = useState<string>("all");

  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>(() => ({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  }));

  const getPresetDates = (preset: DatePreset) => {
    let from: Date;
    const to = new Date(); // Always use current date as end date

    if (preset.days === 0) {
      // Today
      from = startOfDay(new Date());
    } else if (preset.days === "month") {
      // This month
      from = new Date(to.getFullYear(), to.getMonth(), 1);
    } else if (preset.days === "year") {
      // This year
      from = new Date(to.getFullYear(), 0, 1);
    } else {
      // Last X days
      from = new Date(to);
      from.setDate(to.getDate() - preset.days);
    }

    return {
      from: startOfDay(from),
      to: endOfDay(to),
    };
  };

  const isWithinDateRange = (sessionDate: string | null): boolean => {
    if (!dateRange.from && !dateRange.to) return true;
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

  const findBestLaps = (sessions: Session[]): BestLapRecord[] => {
    const bestLaps: BestLapRecord[] = [];

    sessions.forEach((session) => {
      const bestLapTime = Math.min(...session.laps);
      const lapNumber = session.laps.indexOf(bestLapTime) + 1;

      // Get penalties for this specific lap
      const lapPenalties = session.penalties?.find((p) => p.lapNumber === lapNumber)?.count || 0;

      bestLaps.push({
        sessionId: session.id,
        date: session.date,
        driverName: session.driverName,
        carName: session.carName,
        lapTime: bestLapTime,
        lapNumber: lapNumber,
        penalties: lapPenalties,
      });
    });

    return bestLaps.sort((a, b) => a.lapTime - b.lapTime);
  };

  const bestLaps = findBestLaps(sessions);

  // Get unique drivers
  const uniqueDrivers = Array.from(new Set(bestLaps.map((lap) => lap.driverName))).filter((name) => name && name.trim() !== "");

  // Get cars for selected driver
  const getAvailableCars = (driverName: string) => {
    return Array.from(new Set(bestLaps.filter((lap) => lap.driverName === driverName).map((lap) => lap.carName))).filter((name) => name && name.trim() !== "");
  };

  // Reset car filter when driver changes
  useEffect(() => {
    if (filterDriver === "all" || filterCar !== "all") {
      setFilterCar("all");
    }
  }, [filterDriver]);

  const filteredBestLaps = bestLaps.filter((lap) => {
    if (filterDriver !== "all" && lap.driverName !== filterDriver) return false;
    if (filterCar !== "all" && lap.carName !== filterCar) return false;
    if (!isWithinDateRange(lap.date)) return false;
    return true;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Best Laps Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="space-x-4 mb-4">
          <div className="space-y-2">
            <Label>Filter by Driver</Label>
            <Select
              value={filterDriver}
              onValueChange={(value) => {
                setFilterDriver(value);
                setFilterCar("all"); // Reset car filter when driver changes
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Drivers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Drivers</SelectItem>
                {uniqueDrivers.map((driver) => (
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
              <SelectTrigger className="w-[200px]" disabled={filterDriver === "all"}>
                <SelectValue placeholder={filterDriver === "all" ? "Select a driver first" : "All Cars"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cars</SelectItem>
                {filterDriver !== "all" &&
                  getAvailableCars(filterDriver).map((car) => (
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

            {/* Preset Buttons */}
            <div className="flex flex-wrap gap-2 mb-4">
              {DATE_PRESETS.map((preset) => {
                const presetDates = getPresetDates(preset);
                const isActive = dateRange.from && dateRange.to && format(dateRange.from, "yyyy-MM-dd") === format(presetDates.from, "yyyy-MM-dd") && format(dateRange.to, "yyyy-MM-dd") === format(presetDates.to, "yyyy-MM-dd");

                return (
                  <Button
                    key={preset.label}
                    variant="outline"
                    size="sm"
                    className={cn("hover:bg-muted", isActive ? "bg-primary text-primary-foreground hover:bg-primary/90" : "")}
                    onClick={() => {
                      const { from, to } = getPresetDates(preset);
                      setDateRange({ from, to });
                    }}
                  >
                    {preset.label}
                  </Button>
                );
              })}
            </div>

            {/* Custom Date Range Selectors */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full sm:w-[240px] justify-start text-left font-normal", !dateRange.from && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? format(dateRange.from, "PPP") : "Select start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateRange.from} onSelect={(date) => setDateRange((prev) => ({ ...prev, from: date }))} initialFocus />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full sm:w-[240px] justify-start text-left font-normal", !dateRange.to && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.to ? format(dateRange.to, "PPP") : "Select end date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateRange.to} onSelect={(date) => setDateRange((prev) => ({ ...prev, to: date }))} disabled={(date) => (dateRange.from ? isBefore(date, dateRange.from) : false)} initialFocus />
                </PopoverContent>
              </Popover>

              <Button variant="outline" onClick={() => setDateRange({ from: undefined, to: undefined })} className="w-full sm:w-auto">
                Reset Dates
              </Button>
            </div>

            {/* Date Range Summary */}
            {(dateRange.from || dateRange.to) && (
              <div className="text-sm text-muted-foreground">
                {dateRange.from && dateRange.to && format(dateRange.from, "yyyy-MM-dd") === format(startOfDay(new Date()), "yyyy-MM-dd") && format(dateRange.to, "yyyy-MM-dd") === format(endOfDay(new Date()), "yyyy-MM-dd") ? (
                  "Showing sessions from today"
                ) : dateRange.from && dateRange.to && format(dateRange.from, "yyyy-MM-dd") === format(getPresetDates(DATE_PRESETS[1]).from, "yyyy-MM-dd") && format(dateRange.to, "yyyy-MM-dd") === format(getPresetDates(DATE_PRESETS[1]).to, "yyyy-MM-dd") ? (
                  "Showing sessions from the last 7 days"
                ) : (
                  <>
                    Showing sessions
                    {dateRange.from && !dateRange.to && ` from ${format(dateRange.from, "PPP")}`}
                    {!dateRange.from && dateRange.to && ` until ${format(dateRange.to, "PPP")}`}
                    {dateRange.from && dateRange.to && ` from ${format(dateRange.from, "PPP")} to ${format(dateRange.to, "PPP")}`}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Best Laps Table */}
        <div className="rounded-md border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-2 text-left">Rank</th>
                <th className="p-2 text-left">Driver</th>
                <th className="p-2 text-left">Car</th>
                <th className="p-2 text-right">Lap Time</th>
                <th className="p-2 text-right">Lap #</th>
                <th className="p-2 text-right">Penalties</th>
                <th className="p-2 text-right">Session Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredBestLaps.map((lap, index) => (
                <tr
                  key={`${lap.sessionId}-${lap.lapNumber}`}
                  className={`border-b ${index === 0 ? "bg-green-50" : ""} 
          hover:bg-muted/50 transition-colors`}
                >
                  <td className="p-2">{index === 0 ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Best</span> : `#${index + 1}`}</td>
                  <td className="p-2">{lap.driverName}</td>
                  <td className="p-2">{lap.carName}</td>
                  <td className="p-2 text-right font-mono">
                    {formatTime(lap.lapTime)}
                    {index === 0 && <span className="ml-2 text-xs text-green-600">⚡ Fastest</span>}
                  </td>
                  <td className="p-2 text-right">{lap.lapNumber}</td>
                  <td className="p-2 text-right">
                    {lap.penalties > 0 && <span className="text-yellow-600 font-medium">{lap.penalties}</span>}
                    {!lap.penalties && "-"}
                  </td>
                  <td className="p-2 text-right text-sm text-muted-foreground">{formatDateTime(lap.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredBestLaps.length === 0 && <div className="text-center py-8 text-muted-foreground">No lap times found for the selected filters.</div>}
      </CardContent>
    </Card>
  );
}
