"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  accountBundleStore,
  deleteAccount,
  sendCode,
  signInWithCode,
  signOut,
  useCloudAccount,
  type CloudAccount,
} from "@/cloud/account";
import { toCloudError } from "@/cloud/errors";
import { syncWithCloud, type CloudSyncResult } from "@/cloud/sync";
import { DATA_KEY, MOTION_SETTINGS_KEY, useBackupStore, useMarkBackedUp } from "@/data/hooks";
import { describeAge, describeMerge, type MergeWords } from "@/features/data/backup-text";
import { changeBlocker } from "@/features/data/blockers";

const CLOUD_WORDS: MergeWords = { here: "your account", atHere: "in your account", there: "on this phone" };
const PHONE_WORDS: MergeWords = { here: "this phone", atHere: "on this phone", there: "in your account" };

// The operator's privacy notice, if they gave one (docs/cloud.md).
const PRIVACY_URL = /^https:\/\//.test(process.env.NEXT_PUBLIC_CLOUD_PRIVACY_URL ?? "")
  ? process.env.NEXT_PUBLIC_CLOUD_PRIVACY_URL
  : null;

const syncedAtKey = (account: CloudAccount) => `rc-lap-timer-cloud-synced-at:${account.id}`;

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
    // Private browsing: it shows "never" next time.
  }
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
  const queryClient = useQueryClient();
  const markBackedUp = useMarkBackedUp();
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [result, setResult] = useState<CloudSyncResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => setSyncedAt(readSetting(syncedAtKey(account))), [account]);

  const sync = useMutation({
    mutationFn: async () => syncWithCloud(local!, await accountBundleStore()),
    onSuccess: async () => {
      const now = new Date().toISOString();
      saveSetting(syncedAtKey(account), now);
      setSyncedAt(now);
      // The account now holds everything this phone has, which is as good as a backup.
      markBackedUp.mutate(now);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: DATA_KEY }),
        queryClient.invalidateQueries({ queryKey: MOTION_SETTINGS_KEY }),
      ]);
    },
  });
  const leave = useMutation({ mutationFn: (deleting: boolean) => (deleting ? deleteAccount() : signOut()) });

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
      setProblem(toCloudError(error).message);
    }
  };

  const finish = async (deleting: boolean) => {
    setProblem(null);
    try {
      await leave.mutateAsync(deleting);
    } catch (error) {
      setProblem(toCloudError(error).message);
    }
  };

  return (
    <>
      <p>
        Signed in as <strong>{account.email}</strong>.
      </p>
      <p>
        Syncing shares drivers, cars, locations, sessions and motion settings both ways between this phone and your
        account.
      </p>
      <p>Last synced: {syncedAt ? describeAge(syncedAt, new Date()) : "never"}.</p>
      <Button onClick={() => void start()} disabled={!local || sync.isPending || leave.isPending}>
        {sync.isPending ? "Syncing…" : "Sync now"}
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
          <Button variant="outline" disabled={sync.isPending || leave.isPending} onClick={() => void finish(false)}>
            Sign out
          </Button>
          <Button
            variant="ghost"
            disabled={sync.isPending || leave.isPending}
            onClick={() => setConfirmingDelete(true)}
          >
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
