// Syncing with the account automatically (docs/cloud.md): after any change on this phone, and now and then to bring in
// other phones' changes. A change made offline (the phone is often on a timer's Wi-Fi, which has no internet) waits,
// and goes when the connection is back.

import { useSyncExternalStore } from "react";
import { cloudProblem, toCloudError } from "./errors";

// Sync at least this often while the app is open, to bring in other phones' changes.
export const PULL_EVERY_MS = 15 * 60_000;
// After a failed sync, wait this long before trying again (unless the connection comes back): longer each time.
export const RETRY_MS = [60_000, 120_000, 300_000, 600_000];

// The last sync: this phone's change count it covered (see changeCount in src/data/types.ts), and when.
export interface SyncRecord {
  count: number;
  at: number;
}

// Whether to sync: something changed since the last sync, there's never been one, or it's been a while.
export function syncDue(changeCount: number, last: SyncRecord | null, now: number): boolean {
  return last === null || changeCount > last.count || now - last.at >= PULL_EVERY_MS;
}

export function retryDelay(failures: number): number {
  return RETRY_MS[Math.min(Math.max(failures, 1), RETRY_MS.length) - 1];
}

const recordKey = (accountId: string) => `rc-lap-timer-cloud-synced:${accountId}`;

export function readSyncRecord(accountId: string): SyncRecord | null {
  try {
    const record: unknown = JSON.parse(localStorage.getItem(recordKey(accountId)) ?? "null");
    if (typeof record !== "object" || record === null) return null;
    const { count, at } = record as Record<string, unknown>;
    return typeof count === "number" && typeof at === "number" ? { count, at } : null;
  } catch {
    return null;
  }
}

export function saveSyncRecord(accountId: string, record: SyncRecord) {
  try {
    localStorage.setItem(recordKey(accountId), JSON.stringify(record));
  } catch {
    // not remembered: the next check syncs again, which changes nothing
  }
  emit();
}

// The "Sync automatically" switch, on unless turned off on this phone.
const ENABLED_KEY = "rc-lap-timer-cloud-auto";

export function autoSyncEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setAutoSyncEnabled(on: boolean) {
  try {
    if (on) localStorage.removeItem(ENABLED_KEY);
    else localStorage.setItem(ENABLED_KEY, "off");
  } catch {
    // still applies until the app is reloaded
  }
  emit();
}

// What the account card shows about syncing.
export type SyncState =
  | { kind: "idle" }
  | { kind: "syncing" }
  // A running or unsaved session holds syncing back, or the last try failed (offline, or otherwise).
  | { kind: "waiting"; reason: "blocked" | "offline" | "error"; message?: string };

let state: SyncState = { kind: "idle" };
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version++;
  listeners.forEach((listener) => listener());
}

export function syncState(): SyncState {
  return state;
}

export function setSyncState(next: SyncState) {
  if (JSON.stringify(next) === JSON.stringify(state)) return;
  state = next;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAutoSyncEnabled(): boolean {
  return useSyncExternalStore(subscribe, autoSyncEnabled, () => true);
}

// The sync state, and a number that changes whenever it, the switch or a sync record does.
export function useSyncState(): { state: SyncState; version: number } {
  const current = useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
  return { state, version: current };
}

// One sync at a time, whether started by a tap or automatically: a second caller gets the running one's result.
let running: Promise<unknown> | null = null;

export function isSyncing(): boolean {
  return running !== null;
}

export function exclusive<T>(run: () => Promise<T>): Promise<T> {
  if (running) return running as Promise<T>;
  const current = run().finally(() => {
    running = null;
  });
  running = current;
  return current;
}

export interface AutoSyncDeps {
  // Signed in, with the switch on.
  ready(): boolean;
  // A running or unsaved session, which syncing mustn't change under.
  blocked(): boolean;
  changeCount(): Promise<number>;
  lastSync(): SyncRecord | null;
  // Syncs, and records it (through exclusive and saveSyncRecord).
  sync(): Promise<unknown>;
  now(): number;
}

// Decides when to sync, each time it's asked to check: on opening the app, a change, coming back to the screen, the
// connection coming back, and every minute or so.
export class AutoSyncScheduler {
  private failures = 0;
  private retryAt = 0;
  private checking = false;

  constructor(private readonly deps: AutoSyncDeps) {}

  // `connected`: the connection just came back, so don't wait out a failed try's delay.
  async check({ connected = false } = {}): Promise<void> {
    if (this.checking || isSyncing() || !this.deps.ready()) return;
    const now = this.deps.now();
    if (!connected && now < this.retryAt) return;
    this.checking = true;
    try {
      if (this.deps.blocked()) {
        setSyncState({ kind: "waiting", reason: "blocked" });
        return;
      }
      if (!syncDue(await this.deps.changeCount(), this.deps.lastSync(), now)) {
        if (state.kind !== "idle") setSyncState({ kind: "idle" });
        return;
      }
      setSyncState({ kind: "syncing" });
      await this.deps.sync();
      this.failures = 0;
      this.retryAt = 0;
      setSyncState({ kind: "idle" });
    } catch (error) {
      this.failures++;
      this.retryAt = now + retryDelay(this.failures);
      setSyncState({
        kind: "waiting",
        reason: cloudProblem(error) === "offline" ? "offline" : "error",
        message: toCloudError(error).message,
      });
    } finally {
      this.checking = false;
    }
  }
}
