"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DATA_KEY, MOTION_SETTINGS_KEY, errorMessage, useBackupStore, useMarkBackedUp } from "@/data/hooks";
import { useDeviceInfo } from "@/pwa/install";
import { describeMerge, type MergeWords } from "./backup-text";
import { changeBlocker } from "./blockers";
import { DEFAULT_TIMER_ADDRESS, SyncError, syncWithTimer, type SyncResult } from "./sync";

const ADDRESS_KEY = "rc-lap-timer-sync-address";
const LAST_URL_KEY = "rc-lap-timer-sync-url";

const TIMER_WORDS: MergeWords = { here: "the timer", atHere: "on the timer", there: "on this phone" };
const PHONE_WORDS: MergeWords = { here: "this phone", atHere: "on this phone", there: "on the timer" };

function readSetting(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function saveSetting(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private browsing: the default is used next time.
  }
}

// Manager → Data in the phone-only app: sync with a timer (a Raspberry Pi running RC Lap Timer) over its Wi-Fi.
export function SyncCard() {
  const local = useBackupStore();
  const device = useDeviceInfo();
  const queryClient = useQueryClient();
  const markBackedUp = useMarkBackedUp();
  const [address, setAddress] = useState(DEFAULT_TIMER_ADDRESS);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const saved = readSetting(ADDRESS_KEY);
    if (saved) setAddress(saved);
  }, []);

  const sync = useMutation({
    mutationFn: () =>
      syncWithTimer(local!, {
        address: address.trim() || DEFAULT_TIMER_ADDRESS,
        lastWorked: readSetting(LAST_URL_KEY),
      }),
    onSuccess: async ({ baseUrl }) => {
      saveSetting(LAST_URL_KEY, baseUrl);
      // The timer now holds everything this phone has, which is as good as a backup.
      markBackedUp.mutate(new Date().toISOString());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: DATA_KEY }),
        queryClient.invalidateQueries({ queryKey: MOTION_SETTINGS_KEY }),
      ]);
    },
  });

  const start = async () => {
    const blocker = changeBlocker("syncing");
    if (blocker) {
      alert(blocker);
      return;
    }
    setResult(null);
    setProblem(null);
    try {
      setResult(await sync.mutateAsync());
    } catch (error) {
      setProblem(error instanceof SyncError ? error.message : errorMessage(error));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowLeftRight className="h-5 w-5" />
          Sync with the timer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          Have an RC Lap Timer box (the Raspberry Pi timer)? Syncing shares drivers, cars, locations, sessions and
          motion settings both ways. Join the timer&apos;s Wi-Fi (<strong>rc-lap-timer</strong>), then tap Sync.
        </p>
        {device.ios ? (
          <details>
            <summary className="cursor-pointer font-medium">Set up this iPhone or iPad (once)</summary>
            <div className="mt-2 space-y-2">
              <p>To sync this way, an iPhone or iPad has to trust the timer. On the timer&apos;s Wi-Fi:</p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>
                  In Safari, open <strong>192.168.4.1/rc-lap-timer-ca.crt</strong> and tap Allow.
                </li>
                <li>
                  Open Settings, tap <strong>Profile Downloaded</strong>, then Install.
                </li>
                <li>
                  In Settings → General → About → <strong>Certificate Trust Settings</strong>, turn on RC Lap Timer.
                </li>
              </ol>
              <p className="text-muted-foreground">
                The timer&apos;s own pages stop showing a certificate warning too. A timer makes a new certificate about
                every two years; then do this again.
              </p>
            </div>
          </details>
        ) : (
          <p className="text-muted-foreground">
            The first time, Chrome asks whether this app may look for devices on your local network: choose Allow.
          </p>
        )}
        <Button onClick={() => void start()} disabled={!local || sync.isPending}>
          {sync.isPending ? "Syncing…" : "Sync with the timer"}
        </Button>

        {result && (
          <div role="status" className="space-y-2 rounded bg-muted p-3">
            <p>Synced with the timer.</p>
            {result.clockSet && <p>Set the timer&apos;s clock to this phone&apos;s time.</p>}
            <p className="font-medium">On the timer:</p>
            <ul className="list-disc pl-5">
              {describeMerge(result.timer, "did", TIMER_WORDS).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="font-medium">On this phone:</p>
            <ul className="list-disc pl-5">
              {describeMerge(result.phone, "did", PHONE_WORDS).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        {problem && (
          <div role="alert" className="space-y-2 rounded border border-red-200 bg-red-50 p-3 text-red-900">
            <p className="font-medium">{problem}</p>
            <p>Things to try:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Check that this phone is still on the timer&apos;s Wi-Fi: phones sometimes leave a network that has no
                internet.
              </li>
              {device.ios ? (
                <li>
                  iPhone and iPad can sync this way only once they trust the timer: see &ldquo;Set up this iPhone or
                  iPad&rdquo; above.
                </li>
              ) : (
                <li>
                  If Chrome asked about devices on your local network and you chose Block, allow it again in Chrome:
                  Settings → Site settings → Local network access.
                </li>
              )}
              <li>
                Use backup files instead: save a backup above, open <strong>https://rc-lap-timer</strong> in the browser
                and restore it in the timer&apos;s Manager → Data. Then save a backup there and restore it here.
              </li>
              <li>If the timer isn&apos;t at {DEFAULT_TIMER_ADDRESS}, change its address below.</li>
            </ul>
          </div>
        )}

        <details className="text-muted-foreground">
          <summary className="cursor-pointer">Timer address</summary>
          <div className="mt-2 space-y-1">
            {/* The summary above says it already; the label is for screen readers. */}
            <Label htmlFor="timer-address" className="sr-only">
              Timer address
            </Label>
            <Input
              id="timer-address"
              value={address}
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              onChange={(event) => {
                setAddress(event.target.value);
                saveSetting(ADDRESS_KEY, event.target.value.trim() || DEFAULT_TIMER_ADDRESS);
              }}
            />
            <p>The timer&apos;s address on its Wi-Fi. Leave it as {DEFAULT_TIMER_ADDRESS} unless you changed it.</p>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
