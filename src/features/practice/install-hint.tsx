"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useDeviceInfo, useInstallOffer } from "@/pwa/install";

const DISMISSED_KEY = "rc-lap-timer-install-hint-dismissed";

// A reminder at the top of Practice, in the phone-only app opened in a browser, to install it before recording
// sessions: on iPhone the installed app doesn't see the data recorded in Safari. Dismissing it is remembered.
export function InstallHint() {
  const device = useDeviceInfo();
  const offer = useInstallOffer();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISSED_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed || device.installed || offer.justInstalled || !(device.ios || offer.canPrompt)) return null;
  return (
    <Alert className="mb-4">
      <Download className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between gap-2">
        <span>Install the app before you record sessions: Manager → Data shows how.</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setDismissed(true);
            try {
              localStorage.setItem(DISMISSED_KEY, "1");
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
