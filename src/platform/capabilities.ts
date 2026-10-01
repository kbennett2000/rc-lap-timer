// What this build of the app can do. The Pi build has the Pi's hardware and server behind it; the phone-only
// (standalone) build runs on the phone alone, so it hides everything that needs them.

export type BuildTarget = "pi" | "standalone";

export interface Capabilities {
  // Race mode and race history (IR beacons, LEDs and race records on the Pi).
  races: boolean;
  // Practice timing with IR beacons.
  irTiming: boolean;
  // Starting a practice session from another phone, through session requests on the Pi.
  remoteControl: boolean;
  // The live view of a running session on another phone.
  liveSessionView: boolean;
  // The Pi's status LEDs and LED display.
  ledDisplay: boolean;
  // Wi-Fi, device name and password settings for the Pi.
  piSystemConfig: boolean;
  // The data lives on the phone itself (the phone-only app): install, storage and backup help.
  onDeviceData: boolean;
  // Accounts, cloud sync, shared tracks and leaderboards (docs/cloud.md): only in a phone-only app built with a
  // Supabase project to use.
  cloud: boolean;
}

export function capabilitiesFor(target: BuildTarget, { cloudConfigured = false } = {}): Capabilities {
  const pi = target === "pi";
  return {
    races: pi,
    irTiming: pi,
    remoteControl: pi,
    liveSessionView: pi,
    ledDisplay: pi,
    piSystemConfig: pi,
    onDeviceData: !pi,
    cloud: !pi && cloudConfigured,
  };
}

// Read as the literal process.env.NEXT_PUBLIC_TARGET, which Next writes into the build, so server and browser agree.
// Unset means the Pi build (the Pi's upgrade script builds without it); next.config.js rejects any other value.
export const BUILD_TARGET: BuildTarget = process.env.NEXT_PUBLIC_TARGET === "standalone" ? "standalone" : "pi";

// next.config.js sets these only in a phone-only build given a Supabase project.
export const CAPABILITIES: Capabilities = capabilitiesFor(BUILD_TARGET, {
  cloudConfigured: Boolean(process.env.NEXT_PUBLIC_CLOUD_URL),
});
