"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  errorMessage,
  useBackupStore,
  useDataVersion,
  useLastBackup,
  useMarkBackedUp,
  useRestoreBackup,
} from "@/data/hooks";
import { parseBundle, type Bundle } from "@/domain/sync/bundle";
import type { MergeSummary } from "@/domain/sync/merge";
import { UNSAVED_SESSIONS_KEY } from "@/features/practice/use-unsaved-sessions";
import { useDeviceInfo } from "@/pwa/install";
import { ACTIVE_RUN_KEY } from "@/timing/active-run-store";
import { backupFileName, describeAge, describeContents, describeMerge } from "./backup-text";

interface PendingRestore {
  bundle: Bundle;
  preview: MergeSummary;
  dropped: number;
}

// Why a restore can't start now, if it can't: it changes the data a running or unsaved session refers to.
function restoreBlocker(): string | null {
  try {
    if (localStorage.getItem(ACTIVE_RUN_KEY)) return "Finish the running session before restoring a backup.";
    const unsaved = JSON.parse(localStorage.getItem(UNSAVED_SESSIONS_KEY) ?? "[]");
    if (Array.isArray(unsaved) && unsaved.length > 0) {
      return "Save or discard the unsaved sessions at the top of the Practice screen before restoring a backup.";
    }
  } catch {
    // Storage blocked: nothing can be running either.
  }
  return null;
}

// Saving a backup file of everything the app holds, and restoring one (merged into what's here, never replacing it).
export function BackupCard() {
  const store = useBackupStore();
  const version = useDataVersion();
  const lastBackup = useLastBackup();
  const markBackedUp = useMarkBackedUp();
  const restore = useRestoreBackup();
  const device = useDeviceInfo();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string[] | null>(null);
  const [pending, setPending] = useState<PendingRestore | null>(null);

  // The file is made ahead of the tap, and again whenever the data changes: on iPhone the share sheet only opens
  // straight from a tap, with nothing waited for in between.
  useEffect(() => {
    if (!store) return;
    let current = true;
    store.exportBundle().then(
      (bundle) => {
        if (!current) return;
        const json = `${JSON.stringify(bundle, null, 2)}\n`;
        setFile(new File([json], backupFileName(new Date()), { type: "application/json" }));
      },
      () => current && setFile(null),
    );
    return () => {
      current = false;
    };
  }, [store, version]);

  if (!store) return null;

  const saved = (where: string) => {
    markBackedUp.mutate(new Date().toISOString());
    setMessage([`Backup saved ${where}.`]);
  };

  // iPhone and iPad: the share sheet (Save to Files, AirDrop...). Elsewhere a download, since Android won't share
  // .json files even though it says it can.
  const save = () => {
    if (!file) return;
    setMessage(null);
    if (device.ios && navigator.canShare?.({ files: [file] })) {
      navigator.share({ files: [file] }).then(
        () => saved("where you shared it"),
        (error: unknown) => {
          if ((error as Error | null)?.name !== "AbortError")
            setMessage([`Couldn't share the backup. ${errorMessage(error)}`]);
        },
      );
      return;
    }
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    saved("to your downloads");
  };

  const chooseFile = () => {
    const blocker = restoreBlocker();
    if (blocker) {
      alert(blocker);
      return;
    }
    setMessage(null);
    input.current?.click();
  };

  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    event.target.value = "";
    if (!chosen) return;
    let json: unknown;
    try {
      json = JSON.parse(await chosen.text());
    } catch {
      setMessage(["That file isn't an RC Lap Timer backup."]);
      return;
    }
    const parsed = parseBundle(json);
    if (!parsed.ok) {
      setMessage([parsed.error]);
      return;
    }
    try {
      const preview = await store.importBundle(parsed.bundle, { dryRun: true });
      setPending({ bundle: parsed.bundle, preview, dropped: parsed.dropped });
    } catch (error) {
      setMessage([errorMessage(error)]);
    }
  };

  const confirmRestore = async () => {
    if (!pending) return;
    const blocker = restoreBlocker();
    if (blocker) {
      alert(blocker);
      return;
    }
    try {
      const summary = await restore.mutateAsync(pending.bundle);
      setPending(null);
      setMessage(["Backup restored.", ...describeMerge(summary, "did")]);
    } catch (error) {
      setMessage([`The backup wasn't restored. ${errorMessage(error)}`]);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Archive className="h-5 w-5" />
          Backups
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          A backup file holds everything in the app. Keep one somewhere safe (Files, a computer, cloud storage) to get
          your data back, or to move it to another phone or browser.
        </p>
        <p>
          Last backup:{" "}
          {lastBackup === undefined ? "…" : lastBackup === null ? "never" : describeAge(lastBackup, new Date())}.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={!file}>
            Save a backup
          </Button>
          <Button variant="outline" onClick={chooseFile} disabled={pending !== null}>
            Restore a backup
          </Button>
          <input
            ref={input}
            type="file"
            accept=".json,application/json"
            className="hidden"
            aria-label="Backup file"
            onChange={readFile}
          />
        </div>

        {pending && (
          <div className="space-y-2 rounded border p-3">
            <p>This backup holds {describeContents(pending.bundle.data)}. Restoring it merges it into this app:</p>
            <ul className="list-disc pl-5">
              {describeMerge(pending.preview, "will").map((line) => (
                <li key={line}>{line}</li>
              ))}
              {pending.dropped > 0 && (
                <li>
                  Leaves out {pending.dropped} {pending.dropped === 1 ? "record" : "records"} the app can&apos;t read.
                </li>
              )}
            </ul>
            <div className="flex gap-2">
              <Button size="sm" onClick={confirmRestore} disabled={restore.isPending}>
                {restore.isPending ? "Restoring…" : "Restore"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPending(null)} disabled={restore.isPending}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {message && (
          <div role="status" className="space-y-1 rounded bg-muted p-3">
            {message.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
