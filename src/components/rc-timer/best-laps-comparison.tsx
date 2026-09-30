"use client";

import { isWithinRange, todayRange, type DateRange } from "@/domain/date-range";
import { DateRangeFilter } from "@/features/history/date-range-filter";
import { useState, useEffect } from "react";
import { formatDateTime, formatLapTime } from "@/domain/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Session, BestLapRecord } from "@/types/rc-timer";
import { Trophy, Search } from "lucide-react";

interface BestLapsComparisonProps {
  sessions: Session[];
}

export function BestLapsComparison({ sessions }: BestLapsComparisonProps) {
  const [filterDriver, setFilterDriver] = useState<string>("all");
  const [filterCar, setFilterCar] = useState<string>("all");

  const [dateRange, setDateRange] = useState<DateRange>(() => todayRange());

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
        driverName: session.driverName,
        carName: session.carName,
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
    if (!isWithinRange(lap.date, dateRange)) return false;
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

            <DateRangeFilter value={dateRange} onChange={setDateRange} />
          </div>
        </div>

        {sessions.length === 0 ? (
          // No sessions at all
          <div className="text-center py-12">
            <Trophy className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No Best Laps Yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Complete some timing sessions to see your best laps here.
            </p>
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
                        <td className="p-2">
                          {index === 0 ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Best
                            </span>
                          ) : (
                            `#${index + 1}`
                          )}
                        </td>
                        <td className="p-2">{lap.driverName}</td>
                        <td className="p-2">{lap.carName}</td>
                        <td className="p-2 text-right font-mono">
                          {formatLapTime(lap.lapTime)}
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
                  <div
                    key={`${lap.sessionId}-${lap.lapNumber}`}
                    className={`p-4 rounded-lg border ${index === 0 ? "bg-green-50 border-green-200" : ""}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        {index === 0 ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Best
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">#{index + 1}</span>
                        )}
                      </div>
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
                          <span className="font-mono font-medium">{formatLapTime(lap.lapTime)}</span>
                          {index === 0 && <span className="ml-2 text-xs text-green-600">⚡ Fastest</span>}
                        </div>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Lap #</span>
                        <span className="font-medium">{lap.lapNumber}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Penalties</span>
                        <span className="font-medium">
                          {lap.penalties > 0 ? <span className="text-yellow-600">{lap.penalties}</span> : "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {filteredBestLaps.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No lap times found for the selected filters.
                </div>
              )}
            </div>
            {filteredBestLaps.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">No lap times found for the selected filters.</div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
