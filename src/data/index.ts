import { createApiDataStore } from "./api-data-store";
import type { DataStore } from "./types";

export * from "./types";

// The store for this build. Both builds use the Pi's API for now; the phone-only build gets an on-device store.
export function createDataStore(): DataStore {
  return createApiDataStore();
}
