import { createApiDataStore } from "./api-data-store";
import { DataStoreError, type BackupStore, type ChangeCounter, type DataStore } from "./types";

export * from "./types";

// A store that loads its implementation the first time it's used, and never before: the page is also prerendered
// at build time, where there's no IndexedDB. A failed load is retried on the next call.
type LocalStore = DataStore & BackupStore & ChangeCounter;

function lazyStore(load: () => Promise<LocalStore>): LocalStore {
  let loading: Promise<LocalStore> | null = null;
  const store = () => {
    loading ??= load().catch((error: unknown) => {
      loading = null;
      if (error instanceof DataStoreError) throw error;
      throw new DataStoreError("unavailable", "The app couldn't load its storage. Reload the app and try again.");
    });
    return loading;
  };
  // Each method waits for the store, then calls it.
  type Store = LocalStore;
  const via = <K extends keyof Store>(key: K): Store[K] =>
    (async (...args: unknown[]) => ((await store())[key] as (...a: unknown[]) => unknown)(...args)) as Store[K];

  return {
    loadSnapshot: via("loadSnapshot"),
    createDriver: via("createDriver"),
    renameDriver: via("renameDriver"),
    deleteDriver: via("deleteDriver"),
    createCar: via("createCar"),
    updateCar: via("updateCar"),
    deleteCar: via("deleteCar"),
    createLocation: via("createLocation"),
    renameLocation: via("renameLocation"),
    deleteLocation: via("deleteLocation"),
    saveSession: via("saveSession"),
    updateSessionNotes: via("updateSessionNotes"),
    deleteSession: via("deleteSession"),
    listMotionSettings: via("listMotionSettings"),
    createMotionSettings: via("createMotionSettings"),
    updateMotionSettings: via("updateMotionSettings"),
    deleteMotionSettings: via("deleteMotionSettings"),
    exportBundle: via("exportBundle"),
    importBundle: via("importBundle"),
    lastBackupAt: via("lastBackupAt"),
    markBackedUp: via("markBackedUp"),
    changeCount: via("changeCount"),
  };
}

// The store for this build: the phone's own storage in the phone-only app, the Pi's API otherwise. The condition is
// written out in full, and the import() sits inside it, so the Pi build leaves the on-device store (and Dexie) out.
export function createDataStore(): DataStore {
  return process.env.NEXT_PUBLIC_TARGET === "standalone"
    ? lazyStore(() => import("./local/local-data-store").then(({ createLocalDataStore }) => createLocalDataStore()))
    : createApiDataStore();
}
