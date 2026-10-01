// Syncing this phone with the signed-in account, for Sync now and for syncing automatically (src/cloud/auto-sync.ts):
// one at a time, recorded, and counted as a backup.

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { CloudAccount } from "@/cloud/account";
import { accountBundleStore } from "@/cloud/account";
import { exclusive, saveSyncRecord, setSyncState } from "@/cloud/auto-sync";
import { CloudError } from "@/cloud/errors";
import { syncWithCloud, type CloudSyncResult } from "@/cloud/sync";
import { DATA_KEY, MOTION_SETTINGS_KEY, useBackupStore, useMarkBackedUp } from "@/data/hooks";
import { useDataStore } from "@/data/provider";
import { isChangeCounter } from "@/data/types";
import { hasChanges } from "@/domain/sync/merge";

export function useCloudSync() {
  const store = useDataStore();
  const local = useBackupStore();
  const queryClient = useQueryClient();
  const markBackedUp = useMarkBackedUp();

  return useCallback(
    (account: CloudAccount): Promise<CloudSyncResult> =>
      exclusive(async () => {
        if (!local) throw new CloudError("unavailable");
        const before = isChangeCounter(store) ? await store.changeCount() : 0;
        const result = await syncWithCloud(local, await accountBundleStore());
        // What the sync wrote on this phone counts as one change (see changeCount); anything else since `before` is
        // still to send.
        saveSyncRecord(account.id, { count: before + (hasChanges(result.phone) ? 1 : 0), at: Date.now() });
        setSyncState({ kind: "idle" });
        // The account now holds everything this phone has, which is as good as a backup.
        markBackedUp.mutate(new Date().toISOString());
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: DATA_KEY }),
          queryClient.invalidateQueries({ queryKey: MOTION_SETTINGS_KEY }),
        ]);
        return result;
      }),
    [store, local, queryClient, markBackedUp],
  );
}
