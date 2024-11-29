import React, { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/utils";

const DATE_PRESETS = [
  { label: "Last 7 Days", days: 7 },
  { label: "Last 30 Days", days: 30 },
  { label: "Last 3 Months", days: 90 },
  { label: "Last Year", days: 365 },
];

interface RaceHistoryProps {
  onFilterChange?: (filters: RaceFilters) => void;
}

interface RaceFilters {
  driver: string;
  car: string;
  location: string;
  dateRange: { from: Date | null; to: Date | null };
}

interface RaceResult {
  id: string;
  date: Date;
  location: string;
  driver: string;
  car: string;
  position: number;
  bestLap: number;
  laps: number;
  status: string;
}

interface Location {
  id: string;
  name: string;
}

interface Driver {
  id: string;
  name: string;
}

interface Car {
  id: string;
  name: string;
}

export const RaceHistory: React.FC<RaceHistoryProps> = ({ onFilterChange }) => {
  const [filterDriver, setFilterDriver] = useState("all");
  const [filterCar, setFilterCar] = useState("all");
  const [filterLocation, setFilterLocation] = useState("all");
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [races, setRaces] = useState<RaceResult[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [cars, setCars] = useState<Car[]>([]);

  const [availableCars, setAvailableCars] = useState<Car[]>([]);
  const [availableLocations, setAvailableLocations] = useState<Location[]>([]);
  const [driversWithRaces, setDriversWithRaces] = useState<Driver[]>([]);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [lookupResponse, racesResponse] = await Promise.all([fetch("/api/races/history/lookup-data"), fetch("/api/races/history/results")]);

        const lookupData = await lookupResponse.json();
        const racesData = await racesResponse.json();

        setDrivers(lookupData.drivers);
        setCars(lookupData.cars);
        setLocations(lookupData.locations);
        setRaces(racesData.map((race) => ({ ...race, date: new Date(race.date) })));
      } catch (error) {
        console.error("Error:", error);
      }
    };
    fetchData();
  }, []);

  // Filter cars when driver changes
  useEffect(() => {
    if (filterDriver === "all") {
      setAvailableCars(cars);
      return;
    }
    const driverCars = cars.filter((car) => {
      const carRaces = races.filter((race) => race.driver === drivers.find((d) => d.id === filterDriver)?.name && race.car === car.name);
      return carRaces.length > 0;
    });
    setAvailableCars(driverCars);
    if (!driverCars.some((c) => c.id === filterCar)) {
      setFilterCar("all");
    }
  }, [filterDriver, cars, races]);

  // Filter locations when car changes
  useEffect(() => {
    const filteredLocations = locations.filter((location) => {
      return races.some((race) => {
        const matchesDriver = filterDriver === "all" || race.driver === drivers.find((d) => d.id === filterDriver)?.name;
        const matchesCar = filterCar === "all" || race.car === cars.find((c) => c.id === filterCar)?.name;
        return matchesDriver && matchesCar && race.location === location.name;
      });
    });
    setAvailableLocations(filteredLocations);
    if (!filteredLocations.some((l) => l.id === filterLocation)) {
      setFilterLocation("all");
    }
  }, [filterDriver, filterCar, races, locations]);

  // Fetch filtered race results
  useEffect(() => {
    const fetchRaces = async () => {
      const response = await fetch("/api/races/history/results");
      const data = await response.json();
      let filtered = data;

      if (filterDriver !== "all") {
        const driverName = drivers.find((d) => d.id === filterDriver)?.name;
        filtered = filtered.filter((race) => race.driver === driverName);
      }
      if (filterCar !== "all") {
        const carName = cars.find((c) => c.id === filterCar)?.name;
        filtered = filtered.filter((race) => race.car === carName);
      }
      if (filterLocation !== "all") {
        const locationName = locations.find((l) => l.id === filterLocation)?.name;
        filtered = filtered.filter((race) => race.location === locationName);
      }

      setRaces(filtered.map((race) => ({ ...race, date: new Date(race.date) })));
    };

    // TODO: delete?
    /*
    const fetchRaces = async () => {
      try {
        const queryParams = new URLSearchParams({
          driver: filterDriver,
          car: filterCar,
          location: filterLocation,
          fromDate: dateRange.from ? dateRange.from.toISOString() : "",
          toDate: dateRange.to ? dateRange.to.toISOString() : "",
        });
        const response = await fetch(`/api/races/history/results?${queryParams}`);
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error("Expected array of races");
        setRaces(data.map((race: any) => ({ ...race, date: new Date(race.date) })));
      } catch (error) {
        console.error("Error fetching race results:", error);
        setRaces([]);
      }
    };
    */

    fetchRaces();
  }, [filterDriver, filterCar, filterLocation, dateRange]);

  const getPresetDates = (preset: { label: string; days: number }) => {
    const to = new Date();
    const from = subDays(to, preset.days);
    return { from, to };
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Race History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <Label>Driver</Label>
              <Select value={filterDriver} onValueChange={setFilterDriver}>
                <SelectTrigger>
                  <SelectValue placeholder="All Drivers" />
                </SelectTrigger>
                {/* Driver Select */}
                <SelectContent>
                  <SelectItem value="all">All Drivers</SelectItem>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Car</Label>
              <Select value={filterCar} onValueChange={setFilterCar}>
                <SelectTrigger>
                  <SelectValue placeholder="All Cars" />
                </SelectTrigger>

                {/* Car Select */}
                <SelectContent>
                  <SelectItem value="all">All Cars</SelectItem>
                  {availableCars.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Location</Label>
              <Select value={filterLocation} onValueChange={setFilterLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>

                {/* Location Select */}
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {availableLocations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date Range Presets */}
          <div className="flex flex-wrap gap-2 mb-4">
            {DATE_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant="outline"
                size="sm"
                className={cn(
                  "hover:bg-muted",
                  dateRange.from && dateRange.to && format(dateRange.from, "yyyy-MM-dd") === format(getPresetDates(preset).from, "yyyy-MM-dd") && format(dateRange.to, "yyyy-MM-dd") === format(getPresetDates(preset).to, "yyyy-MM-dd") ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""
                )}
                onClick={() => setDateRange(getPresetDates(preset))}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {/* Custom Date Range */}
          <div className="flex gap-4 mb-6">
            <div>
              <Label>From</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal", !dateRange.from && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? format(dateRange.from, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateRange.from} onSelect={(date) => setDateRange((prev) => ({ ...prev, from: date }))} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>To</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal", !dateRange.to && "text-muted-foreground")}>
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

          {/* Results Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Car</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Best Lap</TableHead>
                <TableHead>Laps</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {races.map((race) => (
                <TableRow key={race.id}>
                  <TableCell>{format(race.date, "PPP")}</TableCell>
                  <TableCell>{race.location}</TableCell>
                  <TableCell>{race.driver}</TableCell>
                  <TableCell>{race.car}</TableCell>
                  <TableCell>{race.position}</TableCell>
                  <TableCell>{formatTime(race.bestLap)}</TableCell>
                  <TableCell>{race.laps}</TableCell>
                  <TableCell>{race.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
