// The words the Backup card uses for backups and restores. Pure, so they can be tested.

import type { BundleData, RecordKind } from "@/domain/sync/bundle";
import type { MergeSummary } from "@/domain/sync/merge";

const NOUNS: Record<RecordKind, [string, string]> = {
  driver: ["driver", "drivers"],
  car: ["car", "cars"],
  location: ["location", "locations"],
  session: ["session", "sessions"],
  motionSettings: ["motion setting", "motion settings"],
};
const ORDER: RecordKind[] = ["session", "driver", "car", "location", "motionSettings"];

function count(n: number, kind: RecordKind): string {
  return `${n} ${NOUNS[kind][n === 1 ? 0 : 1]}`;
}

// "a", "a and b", "a, b and c".
function list(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

// What a backup file holds, such as "25 sessions, 3 drivers, 4 cars and 2 locations".
export function describeContents(data: BundleData): string {
  const sizes: Record<RecordKind, number> = {
    session: data.sessions.length,
    driver: data.drivers.length,
    car: data.cars.length,
    location: data.locations.length,
    motionSettings: data.motionSettings.length,
  };
  const parts = ORDER.filter((kind) => sizes[kind] > 0).map((kind) => count(sizes[kind], kind));
  return parts.length > 0 ? list(parts) : "nothing";
}

// What a restore changes (or would change), one sentence per kind of change.
export function describeMerge(summary: MergeSummary, tense: "will" | "did"): string[] {
  const verbs = {
    added: tense === "will" ? "Adds" : "Added",
    updated: tense === "will" ? "Updates" : "Updated",
    merged: tense === "will" ? "Combines" : "Combined",
    deleted: tense === "will" ? "Deletes" : "Deleted",
    skipped: tense === "will" ? "Leaves out" : "Left out",
  };
  const phrase = (field: keyof MergeSummary[RecordKind]) =>
    list(ORDER.filter((kind) => summary[kind][field] > 0).map((kind) => count(summary[kind][field], kind)));

  const lines: string[] = [];
  if (phrase("added")) lines.push(`${verbs.added} ${phrase("added")}.`);
  if (phrase("updated")) lines.push(`${verbs.updated} ${phrase("updated")} changed more recently in the backup.`);
  if (phrase("merged")) lines.push(`${verbs.merged} ${phrase("merged")} with ones of the same name here.`);
  if (phrase("deleted")) lines.push(`${verbs.deleted} ${phrase("deleted")} deleted in the backup.`);
  if (phrase("skipped")) {
    const one = ORDER.reduce((total, kind) => total + summary[kind].skipped, 0) === 1;
    lines.push(
      `${verbs.skipped} ${phrase("skipped")} that ${one ? "doesn't" : "don't"} fit here (a driver, car or location is missing, or the name is taken).`,
    );
  }
  if (lines.length === 0) lines.push("Nothing new: this app already has everything in the backup.");
  return lines;
}

// "today", "yesterday", "3 days ago".
export function describeAge(iso: string, now: Date): string {
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export function daysSince(iso: string, now: Date): number {
  return (now.getTime() - Date.parse(iso)) / 86_400_000;
}

// rc-lap-timer-backup-2026-09-30.json, in the phone's own time zone.
export function backupFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `rc-lap-timer-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}
