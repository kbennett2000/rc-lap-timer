"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, HardDrive, Share, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { promptInstall, useDeviceInfo, useInstallOffer } from "@/pwa/install";
import { keepDataOnDevice, readStorageStatus, type StorageStatus } from "@/pwa/storage";
import { BackupCard } from "./backup-card";
import { SyncCard } from "./sync-card";

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Manager's Data tab in the phone-only app: installing the app, backups, syncing with a timer, and how safely the phone
// keeps its data.
export function DataTab() {
  return (
    <div className="space-y-4">
      <InstallCard />
      <BackupCard />
      <SyncCard />
      <StorageCard />
    </div>
  );
}

function InstallCard() {
  const offer = useInstallOffer();
  const device = useDeviceInfo();
  const installed = device.installed || offer.justInstalled;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Install the app
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {installed ? (
          <p>The app is installed on this device.</p>
        ) : (
          <>
            <p>Installed, the app opens from your home screen and works without a connection.</p>
            {offer.canPrompt ? (
              <Button onClick={() => void promptInstall()}>Install app</Button>
            ) : device.ios ? (
              <>
                <ol className="list-decimal space-y-1 pl-5">
                  <li>
                    Tap <Share className="inline h-4 w-4" aria-label="Share" /> Share in Safari.
                  </li>
                  <li>
                    Tap <SquarePlus className="inline h-4 w-4" aria-hidden /> Add to Home Screen, then Add.
                  </li>
                </ol>
                <p className="rounded bg-yellow-50 p-2 text-yellow-900">
                  Install it before you record sessions. The Home Screen app keeps its own data, separate from Safari:
                  sessions recorded here in Safari stay in Safari. Safari can also clear a site&apos;s data if you
                  don&apos;t open it for 7 days; the installed app doesn&apos;t have that limit.
                </p>
              </>
            ) : (
              <p>
                Use your browser&apos;s menu: <strong>Install app</strong> or <strong>Add to Home screen</strong>.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StorageCard() {
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [asked, setAsked] = useState(false);
  const refresh = useCallback(() => readStorageStatus().then(setStatus), []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Your data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>Drivers, cars, locations and sessions are stored on this device only. Nothing is sent anywhere.</p>
        {status?.usage != null && <p>Using {formatBytes(status.usage)}.</p>}
        {status?.supported &&
          (status.persisted ? (
            <p className="text-green-700">This device will keep the data even when it runs low on space.</p>
          ) : (
            <>
              <p>
                When it runs low on space, this browser may clear the data of sites you use rarely. Ask it to keep this
                app&apos;s data:
              </p>
              <Button
                variant="outline"
                onClick={async () => {
                  await keepDataOnDevice();
                  setAsked(true);
                  await refresh();
                }}
              >
                Keep data on this device
              </Button>
              {asked && (
                <p className="text-muted-foreground">
                  The browser didn&apos;t agree yet. It decides for itself; installing the app and using it regularly
                  helps.
                </p>
              )}
            </>
          ))}
      </CardContent>
    </Card>
  );
}
