"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { deleteAccount, sendCode, signInWithCode, signOut, useCloudAccount, type CloudAccount } from "@/cloud/account";
import {
  readSyncRecord,
  setAutoSyncEnabled,
  setSyncState,
  useAutoSyncEnabled,
  useSyncState,
  type SyncState,
} from "@/cloud/auto-sync";
import { toCloudError } from "@/cloud/errors";
import type { CloudSyncResult } from "@/cloud/sync";
import { useBackupStore, useDataVersion } from "@/data/hooks";
import { useDataStore } from "@/data/provider";
import { isChangeCounter } from "@/data/types";
import { describeAge, describeMerge, type MergeWords } from "@/features/data/backup-text";
import { changeBlocker } from "@/features/data/blockers";
import { useCloudSync } from "./use-cloud-sync";

const CLOUD_WORDS: MergeWords = { here: "your account", atHere: "in your account", there: "on this phone" };
const PHONE_WORDS: MergeWords = { here: "this phone", atHere: "on this phone", there: "in your account" };

// The operator's privacy notice, if they gave one (docs/cloud.md).
const PRIVACY_URL = /^https:\/\//.test(process.env.NEXT_PUBLIC_CLOUD_PRIVACY_URL ?? "")
  ? process.env.NEXT_PUBLIC_CLOUD_PRIVACY_URL
  : null;

// What automatic syncing is waiting for, if anything.
function waitingFor(state: SyncState): string | null {
  if (state.kind === "syncing") return "Syncing…";
  if (state.kind !== "waiting") return null;
  if (state.reason === "blocked") return "Changes will sync once the session is finished and saved.";
  if (state.reason === "offline")
    return "Can't reach the cloud service: changes will sync when the connection is back.";
  return state.message ?? null;
}

// How many changes on this phone aren't in the account yet.
function useUnsynced(account: CloudAccount, version: number): number {
  const store = useDataStore();
  const dataVersion = useDataVersion();
  const [unsynced, setUnsynced] = useState(0);
  useEffect(() => {
    if (!isChangeCounter(store)) return;
    let current = true;
    void store.changeCount().then((count) => {
      if (current) setUnsynced(Math.max(0, count - (readSyncRecord(account.id)?.count ?? 0)));
    });
    return () => {
      current = false;
    };
  }, [store, account.id, version, dataVersion]);
  return unsynced;
}

function Problem({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-red-900">
      {message}
    </p>
  );
}

// Manager → Data in the phone-only app, when it's built with a cloud service (docs/cloud.md): signing in, and syncing
// this phone's data with the account.
export function AccountCard() {
  const account = useCloudAccount();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5" />
          Account and cloud sync
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {account === undefined ? <p>…</p> : account ? <SignedIn account={account} /> : <SignIn />}
        {PRIVACY_URL && (
          <p className="text-muted-foreground">
            <a href={PRIVACY_URL} target="_blank" rel="noreferrer" className="underline">
              How your data is handled
            </a>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setProblem(null);
    try {
      await action();
    } catch (error) {
      setProblem(toCloudError(error).message);
    } finally {
      setBusy(false);
    }
  };

  const send = () =>
    run(async () => {
      await sendCode(email);
      setSentTo(email.trim());
      setCode("");
    });

  return (
    <>
      <p>
        Sign in to keep a copy of this phone&apos;s data in your account, and to have the same data on each phone you
        sign in on. There&apos;s no password: each time, we email you a code.
      </p>
      {sentTo === null ? (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <Label htmlFor="cloud-email">Email</Label>
          <Input
            id="cloud-email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Button type="submit" disabled={busy || !email.trim()}>
            {busy ? "Sending…" : "Send code"}
          </Button>
        </form>
      ) : (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            void run(() => signInWithCode(sentTo, code));
          }}
        >
          <p>
            We emailed a code to <strong>{sentTo}</strong>. It can take a minute; check your spam folder too.
          </p>
          <Label htmlFor="cloud-code">Code</Label>
          <Input
            id="cloud-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || !code.trim()}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => void send()}>
              Send a new code
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setSentTo(null);
                setProblem(null);
              }}
            >
              Use another email
            </Button>
          </div>
        </form>
      )}
      <Problem message={problem} />
    </>
  );
}

function SignedIn({ account }: { account: CloudAccount }) {
  const local = useBackupStore();
  const sync = useCloudSync();
  const automatic = useAutoSyncEnabled();
  const { state, version } = useSyncState();
  const unsynced = useUnsynced(account, version);
  const syncedAt = readSyncRecord(account.id)?.at ?? null;
  const [result, setResult] = useState<CloudSyncResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const leave = useMutation({ mutationFn: (deleting: boolean) => (deleting ? deleteAccount() : signOut()) });

  const start = async () => {
    const blocker = changeBlocker("syncing");
    if (blocker) {
      alert(blocker);
      return;
    }
    setResult(null);
    setProblem(null);
    setSyncing(true);
    try {
      setResult(await sync(account));
    } catch (error) {
      setProblem(toCloudError(error).message);
    } finally {
      setSyncing(false);
    }
  };

  const finish = async (deleting: boolean) => {
    setProblem(null);
    try {
      await leave.mutateAsync(deleting);
      setSyncState({ kind: "idle" });
    } catch (error) {
      setProblem(toCloudError(error).message);
    }
  };

  const waiting = waitingFor(state);

  return (
    <>
      <p>
        Signed in as <strong>{account.email}</strong>.
      </p>
      <p>
        Syncing shares drivers, cars, locations, sessions and motion settings both ways between this phone and your
        account.
      </p>
      <div className="flex items-center gap-2">
        <Switch id="cloud-auto" checked={automatic} onCheckedChange={setAutoSyncEnabled} />
        <Label htmlFor="cloud-auto">Sync automatically</Label>
      </div>
      <p className="text-muted-foreground">
        {automatic
          ? "After each change, and every so often to bring in your other phones' changes. Changes made without a connection wait, and go when it's back."
          : "Only when you tap Sync now."}
      </p>
      <p>
        Last synced: {syncedAt ? describeAge(new Date(syncedAt).toISOString(), new Date()) : "never"}.
        {unsynced > 0 && ` ${unsynced} ${unsynced === 1 ? "change" : "changes"} on this phone not synced yet.`}
      </p>
      {automatic && waiting && !syncing && <p data-testid="sync-waiting">{waiting}</p>}
      <Button onClick={() => void start()} disabled={!local || syncing || leave.isPending}>
        {syncing ? "Syncing…" : "Sync now"}
      </Button>

      {result && (
        <div role="status" className="space-y-2 rounded bg-muted p-3">
          <p>Synced with your account.</p>
          <p className="font-medium">In your account:</p>
          <ul className="list-disc pl-5">
            {describeMerge(result.cloud, "did", CLOUD_WORDS).map((line) => (
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
      <Problem message={problem} />

      {confirmingDelete ? (
        <div className="space-y-2 rounded border p-3">
          <p>
            Delete your account? Everything it holds in the cloud is deleted, and this can&apos;t be undone. The data on
            this phone stays.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" disabled={leave.isPending} onClick={() => void finish(true)}>
              {leave.isPending ? "Deleting…" : "Delete my account"}
            </Button>
            <Button variant="outline" disabled={leave.isPending} onClick={() => setConfirmingDelete(false)}>
              Keep it
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={syncing || leave.isPending} onClick={() => void finish(false)}>
            Sign out
          </Button>
          <Button variant="ghost" disabled={syncing || leave.isPending} onClick={() => setConfirmingDelete(true)}>
            Delete account…
          </Button>
        </div>
      )}
      <p className="text-muted-foreground">
        Signing out or deleting the account leaves this phone&apos;s data as it is.
      </p>
    </>
  );
}
