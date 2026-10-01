// Syncing the phone app with the signed-in account in the cloud (docs/cloud.md). The account's data is one bundle, the
// same as a backup file, and the phone merges it with its own by the same rules as a timer does (src/domain/sync):
// this phone's data goes into the account's first, then the result comes back, so both end up holding the same data.
// If another device saves in between, the save is refused and the phone starts again from what that device saved.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BackupStore } from "@/data/types";
import {
  BUNDLE_FORMAT,
  BUNDLE_SCHEMA_VERSION,
  EMPTY_CONTENTS,
  parseBundle,
  type Bundle,
  type BundleContents,
} from "@/domain/sync/bundle";
import { mergeBundles, planWrites, type MergeSummary, type Writes } from "@/domain/sync/merge";
import { CloudError, toCloudError } from "./errors";

export interface SavedBundle {
  bundle: unknown;
  version: number;
}

// Where the account's bundle is kept.
export interface CloudBundleStore {
  // Null when the account has saved nothing yet.
  read(): Promise<SavedBundle | null>;
  // Saves it if the account is still at `version` (0: nothing saved yet), and returns the new version.
  write(bundle: Bundle, version: number): Promise<number | "conflict">;
}

export interface CloudSyncResult {
  // What changed on each side.
  cloud: MergeSummary;
  phone: MergeSummary;
}

const ATTEMPTS = 3;

export function supabaseBundleStore(client: SupabaseClient): CloudBundleStore {
  return {
    async read() {
      const { data, error, status } = await client.from("cloud_bundles").select("bundle, version").maybeSingle();
      if (error) throw toCloudError(error, status);
      return data ? { bundle: data.bundle, version: Number(data.version) } : null;
    },
    async write(bundle, version) {
      const { data, error, status } = await client.rpc("put_bundle", { p_bundle: bundle, p_version: version });
      if (error?.code === "PT409") return "conflict";
      if (error) throw toCloudError(error, status);
      return Number(data);
    },
  };
}

function readSaved(json: unknown): BundleContents {
  const schemaVersion = typeof json === "object" && json !== null && "schemaVersion" in json ? json.schemaVersion : 0;
  if (typeof schemaVersion === "number" && schemaVersion > BUNDLE_SCHEMA_VERSION) throw new CloudError("update-app");
  const parsed = parseBundle(json);
  if (!parsed.ok) throw new CloudError("invalid");
  return parsed.bundle;
}

function changesAnything({ tombstones, aliases, ...tables }: Writes): boolean {
  return (
    tombstones.length > 0 ||
    aliases.length > 0 ||
    Object.values(tables).some((table) => table.put.length > 0 || table.remove.length > 0)
  );
}

export async function syncWithCloud(local: BackupStore, cloud: CloudBundleStore): Promise<CloudSyncResult> {
  const mine = await local.exportBundle();
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const saved = await cloud.read();
    const theirs = saved ? readSaved(saved.bundle) : EMPTY_CONTENTS;
    const { merged, summary } = mergeBundles(theirs, mine);
    const bundle: Bundle = {
      format: BUNDLE_FORMAT,
      schemaVersion: BUNDLE_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      deviceId: mine.deviceId,
      ...merged,
    };
    if (
      changesAnything(planWrites(theirs, merged)) &&
      (await cloud.write(bundle, saved?.version ?? 0)) === "conflict"
    ) {
      continue;
    }
    return { cloud: summary, phone: await local.importBundle(bundle) };
  }
  throw new CloudError("busy");
}
