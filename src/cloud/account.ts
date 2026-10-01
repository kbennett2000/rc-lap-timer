// Signing in to the cloud (docs/cloud.md) with a code sent by email: the same two steps make an account the first time
// and sign in to it after that. A code, rather than a link, because an iPhone opens email links in Safari, which
// doesn't share its storage with the app installed on the Home Screen.

import { useSyncExternalStore } from "react";
import { cloudClient } from "./client";
import { toCloudError } from "./errors";
import { supabaseBundleStore, type CloudBundleStore } from "./sync";

export interface CloudAccount {
  id: string;
  email: string;
}

// Undefined until the sign-in kept in this browser has been read.
let account: CloudAccount | null | undefined;
const listeners = new Set<() => void>();
let watching = false;

function setAccount(next: CloudAccount | null) {
  if (account !== undefined && account?.id === next?.id && account?.email === next?.email) return;
  account = next;
  listeners.forEach((listener) => listener());
}

function watch() {
  if (watching) return;
  watching = true;
  cloudClient().then(
    (client) =>
      client.auth.onAuthStateChange((_event, session) =>
        setAccount(session ? { id: session.user.id, email: session.user.email ?? "" } : null),
      ),
    () => {
      watching = false;
      setAccount(null);
    },
  );
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  watch();
  return () => {
    listeners.delete(listener);
  };
}

// The signed-in account, null when signed out, and undefined while that isn't known yet.
export function useCloudAccount(): CloudAccount | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => account,
    () => undefined,
  );
}

export async function sendCode(email: string): Promise<void> {
  const client = await cloudClient();
  const { error } = await client.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
  if (error) throw toCloudError(error);
}

export async function signInWithCode(email: string, code: string): Promise<void> {
  const client = await cloudClient();
  const { error } = await client.auth.verifyOtp({ email: email.trim(), token: code.replace(/\s/g, ""), type: "email" });
  if (error) throw toCloudError(error);
}

// Signs out on this phone only. The data on it stays.
export async function signOut(): Promise<void> {
  const client = await cloudClient();
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) throw toCloudError(error);
}

// Deletes the account and everything it has in the cloud, then signs out. The data on this phone stays.
export async function deleteAccount(): Promise<void> {
  const client = await cloudClient();
  const { error, status } = await client.rpc("delete_my_account");
  if (error) throw toCloudError(error, status);
  await client.auth.signOut({ scope: "local" });
}

export async function accountBundleStore(): Promise<CloudBundleStore> {
  return supabaseBundleStore(await cloudClient());
}
