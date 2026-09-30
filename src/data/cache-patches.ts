// How each change looks in the cached data, applied as soon as the store confirms it so the screens update at once.
// The cache is then reloaded from the store, which brings in everything else a change touched (the name copies on
// saved sessions, statistics, cascades). Pure, and never modifies the data it's given.

import { sessionStats } from "@/domain/stats";
import type { Car, Driver, Location, MotionSettings, Session } from "@/domain/types";
import type { CarChanges, DataSnapshot, MotionSettingsInput } from "./types";

// The snapshot as the screens use it: sessions carry their statistics.
export interface AppData {
  drivers: Driver[];
  locations: Location[];
  sessions: Session[];
}

export function toAppData(snapshot: DataSnapshot): AppData {
  return { ...snapshot, sessions: snapshot.sessions.map((s) => ({ ...s, stats: sessionStats(s) })) };
}

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);

export const addDriver = (data: AppData, driver: Driver): AppData => ({
  ...data,
  drivers: [...data.drivers.filter((d) => d.id !== driver.id), driver].sort(byName),
});

export const renameDriver = (data: AppData, id: string, name: string): AppData => ({
  ...data,
  drivers: data.drivers.map((d) => (d.id === id ? { ...d, name } : d)).sort(byName),
});

export const removeDriver = (data: AppData, id: string): AppData => ({
  ...data,
  drivers: data.drivers.filter((d) => d.id !== id),
  sessions: data.sessions.filter((s) => s.driverId !== id),
});

export const addCar = (data: AppData, car: Car): AppData => ({
  ...data,
  drivers: data.drivers.map((d) =>
    d.id === car.driverId ? { ...d, cars: [...d.cars.filter((c) => c.id !== car.id), car].sort(byName) } : d,
  ),
});

export const updateCar = (data: AppData, id: string, changes: CarChanges): AppData => ({
  ...data,
  drivers: data.drivers.map((d) =>
    d.cars.some((c) => c.id === id)
      ? { ...d, cars: d.cars.map((c) => (c.id === id ? { ...c, ...changes } : c)).sort(byName) }
      : d,
  ),
});

export const removeCar = (data: AppData, id: string): AppData => ({
  ...data,
  drivers: data.drivers.map((d) =>
    d.cars.some((c) => c.id === id) ? { ...d, cars: d.cars.filter((c) => c.id !== id) } : d,
  ),
  sessions: data.sessions.filter((s) => s.carId !== id),
});

export const addLocation = (data: AppData, location: Location): AppData => ({
  ...data,
  locations: [...data.locations.filter((l) => l.id !== location.id), location].sort(byName),
});

export const renameLocation = (data: AppData, id: string, name: string): AppData => ({
  ...data,
  locations: data.locations.map((l) => (l.id === id ? { ...l, name } : l)).sort(byName),
});

export const removeLocation = (data: AppData, id: string): AppData => ({
  ...data,
  locations: data.locations.filter((l) => l.id !== id),
  sessions: data.sessions.filter((s) => s.locationId !== id),
});

export const setSessionNotes = (data: AppData, id: string, notes: string | null): AppData => ({
  ...data,
  sessions: data.sessions.map((s) => (s.id === id ? { ...s, notes: notes || null } : s)),
});

export const removeSession = (data: AppData, id: string): AppData => ({
  ...data,
  sessions: data.sessions.filter((s) => s.id !== id),
});

export const addMotionSettings = (list: MotionSettings[], settings: MotionSettings): MotionSettings[] =>
  [...list.filter((m) => m.id !== settings.id), settings].sort(byName);

export const updateMotionSettings = (
  list: MotionSettings[],
  id: string,
  input: MotionSettingsInput,
): MotionSettings[] => list.map((m) => (m.id === id ? { ...m, ...input } : m)).sort(byName);

export const removeMotionSettings = (list: MotionSettings[], id: string): MotionSettings[] =>
  list.filter((m) => m.id !== id);
