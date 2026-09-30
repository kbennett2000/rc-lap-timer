// How safely the phone keeps the app's data. Browsers may clear a site's storage when space runs low, unless it has
// been marked as persistent. Chrome and Safari decide that themselves (for installed apps, and sites people use
// often) without asking. navigator.storage only exists on HTTPS pages.

export interface StorageStatus {
  supported: boolean;
  persisted: boolean;
  // Bytes, when the browser says.
  usage: number | null;
}

export async function readStorageStatus(): Promise<StorageStatus> {
  const storage = typeof navigator === "undefined" ? undefined : navigator.storage;
  if (!storage?.persisted) return { supported: false, persisted: false, usage: null };
  const [persisted, estimate] = await Promise.all([
    storage.persisted().catch(() => false),
    storage.estimate ? storage.estimate().catch(() => null) : Promise.resolve(null),
  ]);
  return { supported: true, persisted, usage: estimate?.usage ?? null };
}

// Asks the browser to keep the data. True if it will.
export async function keepDataOnDevice(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
