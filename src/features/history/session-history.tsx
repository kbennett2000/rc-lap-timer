"use client";

import { useState } from "react";
import { ListX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrentSessionDisplay } from "@/components/current-session-display";
import { SessionRequestForm } from "@/components/session-request-form";
import { isWithinRange, todayRange, type DateRange } from "@/domain/date-range";
import { sortNewestFirst } from "@/domain/sessions";
import type { Driver, Location, Session } from "@/domain/types";
import { SessionCard } from "@/features/practice/session-card";
import { DateRangeFilter } from "./date-range-filter";

const uniqueNames = (names: string[]) =>
  Array.from(new Set(names))
    .filter((name) => name && name.trim() !== "")
    .sort((a, b) => a.localeCompare(b));

interface SessionHistoryProps {
  sessions: Session[];
  drivers: Driver[];
  locations: Location[];
  onDelete: (session: Session) => void;
}

// The Session Mgmt tab: the live view of a session running on another device, the request form for remote control,
// and every saved session with filters.
export function SessionHistory({ sessions, drivers, locations, onDelete }: SessionHistoryProps) {
  const [driver, setDriver] = useState("all");
  const [car, setCar] = useState("all");
  const [location, setLocation] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>(() => todayRange());

  const filtered = sortNewestFirst(
    sessions
      .filter((s) => isWithinRange(s.date, dateRange))
      .filter((s) => driver === "all" || s.driverName === driver)
      .filter((s) => car === "all" || s.carName === car)
      .filter((s) => location === "all" || s.locationName === location),
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Current Session</CardTitle>
        </CardHeader>
        <CardContent>
          <CurrentSessionDisplay />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Request a Session</CardTitle>
        </CardHeader>
        <CardContent>
          <SessionRequestForm drivers={drivers} locations={locations} />
        </CardContent>
      </Card>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <ListX className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No Sessions Recorded</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Record your first timing session to see it appear here.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Previous Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div className="space-y-2">
                <Label>Filter by Driver</Label>
                <Select
                  value={driver}
                  onValueChange={(value) => {
                    setDriver(value);
                    setCar("all");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Drivers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Drivers</SelectItem>
                    {uniqueNames(sessions.map((s) => s.driverName)).map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Filter by Car</Label>
                <Select value={car} onValueChange={setCar} disabled={driver === "all"}>
                  <SelectTrigger disabled={driver === "all"}>
                    <SelectValue placeholder={driver === "all" ? "Select a driver first" : "All Cars"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cars</SelectItem>
                    {driver !== "all" &&
                      uniqueNames(sessions.filter((s) => s.driverName === driver).map((s) => s.carName)).map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Filter by Location</Label>
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {uniqueNames(sessions.map((s) => s.locationName)).map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mb-6">
              <DateRangeFilter value={dateRange} onChange={setDateRange} />
            </div>

            <div className="space-y-6">
              {filtered.map((session) => (
                <SessionCard key={session.id} session={session} onDelete={onDelete} />
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">No sessions match these filters.</div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
