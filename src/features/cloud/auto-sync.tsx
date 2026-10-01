"use client";

import { useEffect, useMemo, useRef } from "react";
import { useCloudAccount } from "@/cloud/account";
import { AutoSyncScheduler, autoSyncEnabled, readSyncRecord, useAutoSyncEnabled } from "@/cloud/auto-sync";
import { useDataVersion } from "@/data/hooks";
import { useDataStore } from "@/data/provider";
import { isChangeCounter } from "@/data/types";
import { changeBlocker } from "@/features/data/blockers";
import { useCloudSync } from "./use-cloud-sync";

// How often to check while the app is on the screen: for a failed sync's retry, a session that held syncing back, and
// other phones' changes.
const CHECK_EVERY_MS = 60_000;

// Syncs with the signed-in account by itself, in an app built with a cloud service (docs/cloud.md): mounted once, for
// the whole app, and shows nothing. The account card shows how it's going.
export default function CloudAutoSync() {
  const account = useCloudAccount();
  const enabled = useAutoSyncEnabled();
  const store = useDataStore();
  const sync = useCloudSync();
  const dataVersion = useDataVersion();
  const latest = useRef({ account, store, sync });
  latest.current = { account, store, sync };

  const scheduler = useMemo(
    () =>
      new AutoSyncScheduler({
        ready: () => Boolean(latest.current.account) && autoSyncEnabled(),
        blocked: () => changeBlocker("syncing") !== null,
        changeCount: async () => {
          const current = latest.current.store;
          return isChangeCounter(current) ? current.changeCount() : 0;
        },
        lastSync: () => (latest.current.account ? readSyncRecord(latest.current.account.id) : null),
        sync: () => latest.current.sync(latest.current.account!),
        now: () => Date.now(),
      }),
    [],
  );

  // On signing in, turning it on, and every change to the data (a saved session, say).
  useEffect(() => {
    void scheduler.check();
  }, [scheduler, account?.id, enabled, dataVersion]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void scheduler.check();
    };
    const onOnline = () => void scheduler.check({ connected: true });
    const timer = setInterval(onVisible, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [scheduler]);

  return null;
}
