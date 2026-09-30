import { addDays, endOfDay, format, isValid, parseISO, startOfDay } from "date-fns";

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export interface DatePreset {
  label: string;
  days: number | "month" | "year";
}

export const DATE_PRESETS: DatePreset[] = [
  { label: "Today", days: 0 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "This month", days: "month" },
  { label: "This year", days: "year" },
];

// Whole days: from the start of the first day to the end of today.
export function presetRange(preset: DatePreset, now: Date = new Date()): { from: Date; to: Date } {
  const to = endOfDay(now);
  if (preset.days === "month") return { from: new Date(now.getFullYear(), now.getMonth(), 1), to };
  if (preset.days === "year") return { from: new Date(now.getFullYear(), 0, 1), to };
  return { from: startOfDay(addDays(now, -preset.days)), to };
}

export function todayRange(now: Date = new Date()): { from: Date; to: Date } {
  return presetRange(DATE_PRESETS[0], now);
}

const dayKey = (date: Date) => format(date, "yyyy-MM-dd");

export function isSameDayRange(range: DateRange, other: { from: Date; to: Date }): boolean {
  return Boolean(
    range.from && range.to && dayKey(range.from) === dayKey(other.from) && dayKey(range.to) === dayKey(other.to),
  );
}

// Whether an ISO date falls in the range, counting both end days in full. No range means everything matches.
export function isWithinRange(iso: string | null | undefined, range: DateRange): boolean {
  if (!range.from && !range.to) return true;
  if (!iso) return false;
  const date = parseISO(iso);
  if (!isValid(date)) return false;
  if (range.from && date < startOfDay(range.from)) return false;
  if (range.to && date > endOfDay(range.to)) return false;
  return true;
}

// "Showing sessions from today", "... from Sep 1st, 2026 to Sep 30th, 2026", or null when there is no range.
export function describeRange(range: DateRange, now: Date = new Date()): string | null {
  if (!range.from && !range.to) return null;
  if (isSameDayRange(range, todayRange(now))) return "Showing sessions from today";
  if (range.from && range.to) return `Showing sessions from ${format(range.from, "PPP")} to ${format(range.to, "PPP")}`;
  if (range.from) return `Showing sessions from ${format(range.from, "PPP")}`;
  return `Showing sessions until ${format(range.to as Date, "PPP")}`;
}
