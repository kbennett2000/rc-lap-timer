"use client";

import { isWithinRange, todayRange, type DateRange } from "@/domain/date-range";
import { DateRangeFilter } from "@/features/history/date-range-filter";
import { logger } from "@/lib/logger";
import { useState, useEffect } from "react";
import { formatDateTime } from "@/domain/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Edit, Save, FileText } from "lucide-react";
import { Session } from "@/types/rc-timer";
import { cn } from "@/lib/utils";

interface SessionNotesProps {
  sessions: Session[];
  // Called after notes are saved so the parent's session list shows them right away.
  onNotesSaved?: (sessionId: string, notes: string) => void;
}

export function SessionNotes({ sessions, onNotesSaved }: SessionNotesProps) {
  const [filterDriver, setFilterDriver] = useState<string>("all");
  const [filterCar, setFilterCar] = useState<string>("all");
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState("");

  const [dateRange, setDateRange] = useState<DateRange>(() => todayRange());

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

  // Update component when sessions prop changes
  useEffect(() => {
    // If currently selected session has been updated, refresh its data
    if (selectedSession) {
      const updatedSession = sessions.find((s) => s.id === selectedSession.id);
      if (updatedSession && updatedSession.notes !== notes && !isEditing) {
        setNotes(updatedSession.notes || "");
      }
    }
  }, [sessions, selectedSession, isEditing]);

  // Reset car filter when driver changes
  useEffect(() => {
    if (filterDriver === "all") {
      setFilterCar("all");
    }
  }, [filterDriver]);

  // Filter sessions
  const filteredSessions = sessions
    .filter((session) => {
      if (filterDriver !== "all" && session.driverName !== filterDriver) return false;
      if (filterCar !== "all" && session.carName !== filterCar) return false;
      if (!isWithinRange(session.date, dateRange)) return false;
      return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Handle notes update
  const handleSaveNotes = async () => {
    if (!selectedSession) return;

    try {
      const response = await fetch("/api/data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: selectedSession.id,
          notes: notes,
        }),
      });

      if (!response.ok) throw new Error("Failed to save notes");
      onNotesSaved?.(selectedSession.id, notes);
      setIsEditing(false);
    } catch (error) {
      logger.error("Error saving notes:", error);
      alert("Failed to save notes. Please try again.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session Notes</CardTitle>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No Sessions Available</h3>
            <p className="mt-2 text-sm text-muted-foreground">Record some sessions to add notes.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Filters Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Driver Filter */}
              <div className="space-y-2">
                <Label>Filter by Driver</Label>
                <Select
                  value={filterDriver}
                  onValueChange={(value) => {
                    setFilterDriver(value);
                    if (value === "all") setFilterCar("all");
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

              <DateRangeFilter value={dateRange} onChange={setDateRange} />
            </div>

            {/* Sessions and Notes Display */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Sessions List */}
              <div className="space-y-4">
                <h3 className="font-semibold">Select Session</h3>
                <div className="space-y-2">
                  {filteredSessions.map((session) => (
                    <div
                      key={session.id}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-colors",
                        selectedSession?.id === session.id ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50",
                      )}
                      onClick={() => {
                        setSelectedSession(session);
                        setNotes(session.notes || "");
                        setIsEditing(false);
                      }}
                    >
                      <div className="font-medium">{session.driverName}</div>
                      <div className="text-sm text-muted-foreground">{session.carName}</div>
                      <div className="text-sm text-muted-foreground">{formatDateTime(session.date)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes Display/Edit */}
              <div className="md:col-span-2 space-y-4">
                {selectedSession ? (
                  <>
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold">Session Notes</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (isEditing) {
                            handleSaveNotes();
                          } else {
                            setIsEditing(true);
                          }
                        }}
                      >
                        {isEditing ? (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save
                          </>
                        ) : (
                          <>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </>
                        )}
                      </Button>
                    </div>
                    {isEditing ? (
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add notes about track conditions, car setup, or anything else..."
                        className="min-h-[200px]"
                      />
                    ) : (
                      <div className="p-4 border rounded-lg min-h-[200px] whitespace-pre-wrap">
                        {notes || "No notes added yet."}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Select a session to view or edit notes
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
