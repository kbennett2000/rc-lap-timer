"use client";

import { useEffect, useState } from "react";
import { Archive } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useLastBackup } from "@/data/hooks";
import { daysSince, describeAge } from "@/features/data/backup-text";

const DISMISSED_KEY = "rc-lap-timer-backup-reminder-dismissed";
const REMIND_AFTER_DAYS = 14;
const SNOOZE_DAYS = 7;

// In the phone-only app, a reminder at the top of Practice to save a backup: when there are sessions and none has
// been saved for two weeks. Dismissing it hides it for a week.
export function BackupReminder({ sessionCount }: { sessionCount: number }) {
  const lastBackup = useLastBackup();
  const [dismissedAt, setDismissedAt] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    try {
      setDismissedAt(localStorage.getItem(DISMISSED_KEY));
    } catch {
      setDismissedAt(null);
    }
  }, []);

  if (sessionCount === 0 || lastBackup === undefined || dismissedAt === undefined) return null;
  const now = new Date();
  if (lastBackup && daysSince(lastBackup, now) < REMIND_AFTER_DAYS) return null;
  if (dismissedAt && daysSince(dismissedAt, now) < SNOOZE_DAYS) return null;

  return (
    <Alert className="mb-4">
      <Archive className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between gap-2">
        <span>
          {lastBackup ? `Your last backup was ${describeAge(lastBackup, now)}.` : "You haven't saved a backup yet."}{" "}
          Save one in Manager → Data, so a lost or reset phone doesn&apos;t take your sessions with it.
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            const at = new Date().toISOString();
            setDismissedAt(at);
            try {
              localStorage.setItem(DISMISSED_KEY, at);
            } catch {
              // Private browsing: it shows again next time.
            }
          }}
        >
          Dismiss
        </Button>
      </AlertDescription>
    </Alert>
  );
}
