import { logger } from "@/lib/logger";
import type { FinishedRun, RunningRun } from "@/timing/engine";
import type { TimingIntegrations } from "./types";

type Fetch = typeof fetch;

interface Rgb {
  red: number;
  green: number;
  blue: number;
}

const GREEN: Rgb = { red: 0, green: 100, blue: 0 };
const RED: Rgb = { red: 100, green: 0, blue: 0 };
const YELLOW: Rgb = { red: 100, green: 30, blue: 0 };
const OFF: Rgb = { red: 0, green: 0, blue: 0 };
const DIM_BLUE: Rgb = { red: 0, green: 0, blue: 25 };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A queue that runs tasks one at a time and logs failures instead of passing them on.
function serialQueue(label: string) {
  let tail: Promise<unknown> = Promise.resolve();
  return (task: () => Promise<unknown>) => {
    tail = tail.then(task).catch((error) => logger.warn(`${label}:`, error));
    return tail;
  };
}

// The Pi's hardware and the live view on other devices:
// - the status LED on the IR service (/api/ir/led, levels 0-100) and the Remote LED display (/api/led/*, 0-255);
// - the current-session record that /api/current-session/summary shows on a second device.
export function createPiIntegrations(fetchImpl: Fetch = (...args) => fetch(...args)): TimingIntegrations {
  const ledQueue = serialQueue("LED");
  const liveQueue = serialQueue("Live session");
  let liveSessionId: string | null = null;

  const request = async (url: string, init?: RequestInit) => {
    const response = await fetchImpl(url, init);
    if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${url} failed (${response.status})`);
    return response;
  };
  const json = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const setColor = async ({ red, green, blue }: Rgb) => {
    await request(`/api/ir/led/${red}/${green}/${blue}`);
    const scale = (level: number) => Math.round(2.55 * level);
    await request(`/api/led/rgb?r=${scale(red)}&g=${scale(green)}&b=${scale(blue)}`);
  };
  const flash = async (color: Rgb, ms: number) => {
    await setColor(color);
    await sleep(ms);
    await setColor(OFF);
  };
  const message = (title: string, text: string) =>
    request(`/api/led/text?title=${encodeURIComponent(title)}&message=${encodeURIComponent(text)}`);
  // Each LED task logs its own failure so a missing display doesn't stop the status LED, and vice versa.
  const led = (task: () => Promise<unknown>) => ledQueue(() => task().catch((error) => logger.warn("LED:", error)));

  return {
    onStart(run: RunningRun) {
      const { driverName, carName, locationName, lapTarget } = run.config;
      led(() => setColor(GREEN));
      led(() => message("Session    Start", `${driverName} - ${carName} at ${locationName}`));

      liveSessionId = null;
      liveQueue(async () => {
        await request("/api/current-session/truncate", { method: "POST" });
        const response = await request(
          "/api/current-session",
          json("POST", { driverName, carName, locationName, lapCount: lapTarget === "unlimited" ? 0 : lapTarget }),
        );
        liveSessionId = (await response.json()).session.id;
      });
    },

    onLap(run, lapNumber, lapTime) {
      led(() => message(`Lap ${lapNumber}`, `${lapTime / 1000} seconds`));
      led(async () => {
        await flash(RED, 1000);
        await setColor(GREEN);
      });

      const penaltyCount = run.penalties.find((p) => p.lapNumber === lapNumber)?.count ?? 0;
      liveQueue(async () => {
        if (!liveSessionId) return; // the create failed; nothing to add to
        await request(
          "/api/current-session",
          json("PUT", { action: "addLap", sessionId: liveSessionId, lapNumber, lapTime, penaltyCount }),
        );
      });
    },

    onPenalty(_run, lapNumber) {
      led(() => message("Penalty   Recorded", `Penalty recorded on  lap number ${lapNumber}`));
      led(async () => {
        await flash(YELLOW, 1000);
        await setColor(GREEN);
      });
    },

    onFinish(_run: FinishedRun) {
      led(() => message("Session   Finished", "All laps complete!"));
      led(async () => {
        for (let i = 0; i < 3; i++) {
          await flash(RED, 500);
          await flash(GREEN, 500);
        }
        await setColor(DIM_BLUE);
      });
      // Remove the live record whether or not the session saves, so the live view doesn't show a stale run.
      liveQueue(async () => {
        const sessionId = liveSessionId;
        liveSessionId = null;
        if (sessionId) await request("/api/current-session", json("DELETE", { sessionId }));
      });
    },
  };
}
