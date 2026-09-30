import { useSyncExternalStore } from "react";

// Installing the phone-only app. Chromium browsers offer to install it with a beforeinstallprompt event, once, soon
// after the page loads and before the Data tab exists, so it's caught here as soon as this module loads. iOS never
// offers: people add the app with Share → Add to Home Screen.

type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export interface InstallOffer {
  // The browser offered to install the app, and Install can take it up.
  canPrompt: boolean;
  // The app was installed from this page.
  justInstalled: boolean;
}

const NO_OFFER: InstallOffer = { canPrompt: false, justInstalled: false };
let offer = NO_OFFER;
let promptEvent: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function setOffer(next: InstallOffer) {
  offer = next;
  listeners.forEach((listener) => listener());
}

if (process.env.NEXT_PUBLIC_TARGET === "standalone" && typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // the Data tab offers it instead of the browser's own banner
    promptEvent = event as InstallPromptEvent;
    setOffer({ ...offer, canPrompt: true });
  });
  window.addEventListener("appinstalled", () => {
    promptEvent = null;
    setOffer({ canPrompt: false, justInstalled: true });
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useInstallOffer(): InstallOffer {
  return useSyncExternalStore(
    subscribe,
    () => offer,
    () => NO_OFFER,
  );
}

// Shows the browser's install dialog. True if the app was installed.
export async function promptInstall(): Promise<boolean> {
  const event = promptEvent;
  if (!event) return false;
  promptEvent = null;
  setOffer({ ...offer, canPrompt: false });
  await event.prompt();
  return (await event.userChoice).outcome === "accepted";
}

export interface DeviceInfo {
  // iPhone or iPad, where apps are added from Safari's Share menu. iPads report themselves as Macs with touch.
  ios: boolean;
  // Running as the installed app rather than in a browser tab.
  installed: boolean;
}

const SERVER_DEVICE: DeviceInfo = { ios: false, installed: false };
let device: DeviceInfo | null = null;

function readDevice(): DeviceInfo {
  device ??= {
    ios:
      /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1),
    installed:
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
  };
  return device;
}

// Known only in the browser: the prerendered page has neither.
export function useDeviceInfo(): DeviceInfo {
  return useSyncExternalStore(
    () => () => {},
    readDevice,
    () => SERVER_DEVICE,
  );
}
