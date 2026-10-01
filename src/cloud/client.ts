// The connection to the Supabase project behind the cloud features (docs/cloud.md). Only code that the build includes
// when the cloud is configured imports this module (see next.config.js), and the Supabase library itself is loaded the
// first time it's needed.

import type { SupabaseClient } from "@supabase/supabase-js";

let client: Promise<SupabaseClient> | undefined;

export function cloudClient(): Promise<SupabaseClient> {
  client ??= import("@supabase/supabase-js")
    .then(({ createClient }) =>
      createClient(process.env.NEXT_PUBLIC_CLOUD_URL ?? "", process.env.NEXT_PUBLIC_CLOUD_KEY ?? "", {
        auth: {
          // Signed in until signing out, in this browser's storage. A sign-in link (if the project's emails send
          // links rather than codes) signs in whichever browser opens it.
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: "rc-lap-timer-cloud-auth",
        },
      }),
    )
    .catch((error: unknown) => {
      // Try loading it again next time, as after the app was offline.
      client = undefined;
      throw error;
    });
  return client;
}
