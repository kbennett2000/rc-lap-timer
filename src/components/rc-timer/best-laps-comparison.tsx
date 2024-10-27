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
import { CalendarIcon, Trophy } from "lucide-react";
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
      const lapTimes = session.laps.map((lap) => lap.lapTime);
      const bestLapTime = Math.min(...lapTimes);
      const bestLap = session.laps.find((lap) => lap.lapTime === bestLapTime);
      if (!bestLap) return;

      // Get penalties for this lap
      const lapPenalties = session.penalties.find((p) => p.lapNumber === bestLap.lapNumber)?.count || 0;

      bestLaps.push({
        sessionId: session.id,
        date: session.date,
        driverName: session.driver.name,
        carName: session.car.name,
        lapTime: bestLapTime,
        lapNumber: bestLap.lapNumber,
        penalties: lapPenalties,
      });
    });

    return bestLaps.sort((a, b) => a.lapTime - b.lapTime);
  };

  const bestLaps = findBestLaps(sessions);

  // Get unique drivers - sorted alphabetically
  const uniqueDrivers = Array.from(new Set(bestLaps.map((lap) => lap.driverName)))
    .filter((name) => name && name.trim() !== "")
    .sort((a, b) => a.localeCompare(b));

  // Get cars for selected driver - sorted alphabetically
  const getAvailableCars = (driverName: string) => {
    return Array.from(new Set(bestLaps.filter((lap) => lap.driverName === driverName).map((lap) => lap.carName)))
      .filter((name) => name && name.trim() !== "")
      .sort((a, b) => a.localeCompare(b));
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
        {sessions.length === 0 ? (
          // No sessions at all
          <div className="text-center py-12">
            <Trophy className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No Best Laps Yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">Complete some timing sessions to see your best laps here.</p>
          </div>
        ) : filteredBestLaps.length === 0 ? (
          // No laps match the filters
          <div className="text-center py-12">
            <Search className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No Matching Laps</h3>
            <p className="mt-2 text-sm text-muted-foreground">Try adjusting your filters to see more lap times.</p>
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="space-x-4 mb-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Filter By Driver */}
                <div className="space-y-2">
                  <Label>Filter by Driver</Label>
                  <Select
                    value={filterDriver}
                    onValueChange={(value) => {
                      setFilterDriver(value);
                      setFilterCar("all"); // Reset car filter when driver changes
                    }}
                  >
                    <SelectTrigger>
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

                {/* Filter By Car */}
                <div className="space-y-2">
                  <Label>Filter by Car</Label>
                  <Select value={filterCar} onValueChange={setFilterCar} disabled={filterDriver === "all"}>
                    <SelectTrigger disabled={filterDriver === "all"}>
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
            </div>
            {/* Best Laps Display - Responsive Design */}
            <div>
              {/* Desktop Table View - Hidden on mobile */}
              <div className="hidden md:block rounded-md border">
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

              {/* Mobile Card View - Shown only on mobile */}
              <div className="md:hidden space-y-4">
                {filteredBestLaps.map((lap, index) => (
                  <div key={`${lap.sessionId}-${lap.lapNumber}`} className={`p-4 rounded-lg border ${index === 0 ? "bg-green-50 border-green-200" : ""}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>{index === 0 ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Best</span> : <span className="text-sm text-muted-foreground">#{index + 1}</span>}</div>
                      <div className="text-right text-sm text-muted-foreground">{formatDateTime(lap.date)}</div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Driver</span>
                        <span className="font-medium">{lap.driverName}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Car</span>
                        <span className="font-medium">{lap.carName}</span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Lap Time</span>
                        <div className="text-right">
                          <span className="font-mono font-medium">{formatTime(lap.lapTime)}</span>
                          {index === 0 && <span className="ml-2 text-xs text-green-600">⚡ Fastest</span>}
                        </div>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Lap #</span>
                        <span className="font-medium">{lap.lapNumber}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Penalties</span>
                        <span className="font-medium">{lap.penalties > 0 ? <span className="text-yellow-600">{lap.penalties}</span> : "-"}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {filteredBestLaps.length === 0 && <div className="text-center py-8 text-muted-foreground">No lap times found for the selected filters.</div>}
            </div>
            {filteredBestLaps.length === 0 && <div className="text-center py-8 text-muted-foreground">No lap times found for the selected filters.</div>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
