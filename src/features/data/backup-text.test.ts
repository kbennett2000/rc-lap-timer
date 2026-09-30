import { describe, expect, it } from "vitest";
import { EMPTY_CONTENTS } from "@/domain/sync/bundle";
import type { MergeSummary } from "@/domain/sync/merge";
import { backupFileName, describeAge, describeContents, describeMerge } from "./backup-text";

const summary = (changes: Partial<Record<keyof MergeSummary, Partial<MergeSummary["driver"]>>> = {}): MergeSummary => {
  const blank = { added: 0, updated: 0, merged: 0, deleted: 0, skipped: 0 };
  return {
    driver: { ...blank, ...changes.driver },
    car: { ...blank, ...changes.car },
    location: { ...blank, ...changes.location },
    session: { ...blank, ...changes.session },
    motionSettings: { ...blank, ...changes.motionSettings },
  };
};

describe("backup text", () => {
  it("describes what a file holds", () => {
    const data = { ...EMPTY_CONTENTS.data, sessions: [{}, {}], drivers: [{}], cars: [{}, {}, {}] } as never;
    expect(describeContents(data)).toBe("2 sessions, 1 driver and 3 cars");
    expect(describeContents(EMPTY_CONTENTS.data)).toBe("nothing");
  });

  it("describes a restore", () => {
    const lines = describeMerge(
      summary({ session: { added: 3, deleted: 1, skipped: 1 }, driver: { added: 1, merged: 1 }, car: { updated: 2 } }),
      "will",
    );
    expect(lines).toEqual([
      "Adds 3 sessions and 1 driver.",
      "Updates 2 cars changed more recently in the backup.",
      "Combines 1 driver with ones of the same name here.",
      "Deletes 1 session deleted in the backup.",
      "Leaves out 1 session that doesn't fit here (a driver, car or location is missing, or the name is taken).",
    ]);
    expect(describeMerge(summary({ session: { added: 1 } }), "did")).toEqual(["Added 1 session."]);
    expect(describeMerge(summary(), "will")).toEqual(["Nothing new: this app already has everything in the backup."]);
  });

  it("says how long ago, in days", () => {
    const now = new Date(2026, 8, 30, 9, 0);
    expect(describeAge(new Date(2026, 8, 30, 1, 0).toISOString(), now)).toBe("today");
    expect(describeAge(new Date(2026, 8, 29, 23, 0).toISOString(), now)).toBe("yesterday");
    expect(describeAge(new Date(2026, 8, 20, 12, 0).toISOString(), now)).toBe("10 days ago");
  });

  it("names the file after the day", () => {
    expect(backupFileName(new Date(2026, 0, 5, 23, 59))).toBe("rc-lap-timer-backup-2026-01-05.json");
  });
});
