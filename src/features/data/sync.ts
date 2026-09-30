// Syncing the phone app with a timer (a Raspberry Pi running RC Lap Timer) over the timer's Wi-Fi. Both sides merge
// with the same rules (src/domain/sync): this phone's data goes to the timer first, then the timer's comes back, so
// both end up holding the same data. Records with the same name fold into the timer's, so every phone that syncs
// with a timer ends up using the timer's ids.

import { createApiDataStore } from "@/data/api-data-store";
import { DataStoreError, type BackupStore, type DataStore } from "@/data/types";
import { BUNDLE_SCHEMA_VERSION, parseBundle } from "@/domain/sync/bundle";
import type { MergeSummary } from "@/domain/sync/merge";

// Where a timer is on its own Wi-Fi.
export const DEFAULT_TIMER_ADDRESS = "192.168.4.1";

// Finding a timer can wait on Chrome's "devices on your local network" prompt; merging on a Pi Zero takes a while.
const FIND_TIMEOUT_MS = 30_000;
const MERGE_TIMEOUT_MS = 120_000;

// The addresses to try, in order. An address with http:// or https:// is used as it is. Otherwise plain HTTP comes
// first: Chrome allows it to a local address once the user allows local network access, and Safari refuses it at
// once (mixed content). Then HTTPS, for browsers that trust the timer's certificate. The one that worked last time
// goes first.
export function timerUrls(address: string, lastWorked?: string | null): string[] {
  const trimmed = address.trim().replace(/\/+$/, "");
  const urls = /^https?:\/\//i.test(trimmed) ? [trimmed] : [`http://${trimmed}`, `https://${trimmed}`];
  return lastWorked && urls.includes(lastWorked) ? [lastWorked, ...urls.filter((url) => url !== lastWorked)] : urls;
}

export type SyncProblem = "unreachable" | "not-a-timer" | "update-app" | "update-timer";

export class SyncError extends Error {
  constructor(
    readonly problem: SyncProblem,
    message: string,
  ) {
    super(message);
    this.name = "SyncError";
  }
}

export interface SyncResult {
  // What changed on each side.
  timer: MergeSummary;
  phone: MergeSummary;
  // The timer's address that worked, to try first next time.
  baseUrl: string;
}

// A fetch for talking to a timer: from this site to the timer's, without cookies, and not forever.
function timerFetch(fetchImpl: typeof fetch, timeoutMs: number): typeof fetch {
  return (input, init) =>
    fetchImpl(input, { ...init, mode: "cors", credentials: "omit", signal: AbortSignal.timeout(timeoutMs) });
}

async function findTimer(urls: string[], fetchImpl: typeof fetch): Promise<{ baseUrl: string; schemaVersion: number }> {
  let answered = false;
  for (const baseUrl of urls) {
    let response: Response;
    try {
      response = await timerFetch(fetchImpl, FIND_TIMEOUT_MS)(`${baseUrl}/api/sync/status`);
    } catch {
      continue;
    }
    answered = true;
    const status: unknown = await response.json().catch(() => null);
    if (response.ok && typeof status === "object" && status && "app" in status && status.app === "rc-lap-timer") {
      const schemaVersion = "schemaVersion" in status ? Number(status.schemaVersion) : NaN;
      return { baseUrl, schemaVersion };
    }
  }
  if (answered) {
    throw new SyncError(
      "not-a-timer",
      "Something answered at that address, but it isn't a timer that can sync. If it is your timer, update its software.",
    );
  }
  throw new SyncError("unreachable", "Couldn't reach the timer.");
}

export async function syncWithTimer(
  local: DataStore & BackupStore,
  {
    address,
    lastWorked,
    fetch: fetchImpl = (...args) => fetch(...args),
  }: {
    address: string;
    lastWorked?: string | null;
    fetch?: typeof fetch;
  },
): Promise<SyncResult> {
  const { baseUrl, schemaVersion } = await findTimer(timerUrls(address, lastWorked), fetchImpl);
  if (!(schemaVersion <= BUNDLE_SCHEMA_VERSION)) {
    throw new SyncError("update-app", "The timer has newer software than this app. Reload the app to update it.");
  }
  if (schemaVersion < BUNDLE_SCHEMA_VERSION) {
    throw new SyncError("update-timer", "The timer's software is older than this app's. Update the timer.");
  }

  const timer = createApiDataStore({ baseUrl, fetch: timerFetch(fetchImpl, MERGE_TIMEOUT_MS) });
  const timerSummary = await timer.importBundle(await local.exportBundle());
  const parsed = parseBundle(await timer.exportBundle());
  if (!parsed.ok) throw new DataStoreError("invalid", parsed.error);
  const phoneSummary = await local.importBundle(parsed.bundle);
  return { timer: timerSummary, phone: phoneSummary, baseUrl };
}
