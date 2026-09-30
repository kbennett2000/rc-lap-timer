"use client";

import { Smartphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackupCard } from "./backup-card";

// Manager's Data tab on the timer: backups of the timer's data, which also carry data to and from the phone app.
export function TimerDataTab() {
  return (
    <div className="space-y-4">
      <BackupCard />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            The phone app
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            RC Lap Timer also works on a phone by itself, without a timer:{" "}
            <strong>kbennett2000.github.io/rc-lap-timer</strong>.
          </p>
          <p>
            To share data with it, tap <strong>Sync with the timer</strong> in the app (Manager → Data) while the phone
            is on this timer&apos;s Wi-Fi. Records with the same name become one, so nothing is doubled.
          </p>
          <p>
            Backup files work too, on any phone: save a backup in the app and restore it here, or save one here and
            restore it in the app.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
