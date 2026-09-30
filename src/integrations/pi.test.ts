import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTimingStore } from "@/timing/timing-store";
import type { RunConfig } from "@/timing/engine";
import { createPiIntegrations } from "./pi";
import { integrationEffect } from "./run-effect";

const config: RunConfig = {
  driverId: "d",
  driverName: "Kris",
  carId: "c",
  carName: "Buggy",
  locationId: "l",
  locationName: "Backyard",
  lapTarget: "unlimited",
  timingMode: "manual",
};

type Call = { url: string; method: string; type: string | null; body?: Record<string, unknown> };

function fakeFetch() {
  const calls: Call[] = [];
  let releaseCreate: () => void = () => {};
  const createGate = new Promise<void>((resolve) => (releaseCreate = resolve));
  const impl = vi.fn(async (url: string, init?: RequestInit) => {
    const call = {
      url,
      method: init?.method ?? "GET",
      type: new Headers(init?.headers).get("content-type"),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    if (url === "/api/current-session" && call.method === "POST") {
      await createGate;
      return new Response(JSON.stringify({ success: true, session: { id: "live-1" } }));
    }
    return new Response("{}");
  });
  return { calls, impl, releaseCreate: () => releaseCreate() };
}

const liveCalls = (calls: Call[]) =>
  calls
    .filter((c) => c.url.startsWith("/api/current-session"))
    .map((c) => ({ method: c.method, url: c.url, body: c.body }));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("Pi integrations", () => {
  it("creates the live record before adding laps, with each lap's own penalties, and deletes it at the end", async () => {
    const fetch = fakeFetch();
    const store = createTimingStore();
    store.addEffect(integrationEffect(createPiIntegrations(fetch.impl as unknown as typeof globalThis.fetch)));

    store.dispatch({ type: "start", at: 0, id: "r", config });
    store.dispatch({ type: "penalty", at: 100 });
    store.dispatch({ type: "penalty", at: 200 });
    store.dispatch({ type: "lap", at: 1000 }); // arrives while the create call is still pending
    store.dispatch({ type: "lap", at: 2500.4 }); // sub-millisecond timestamps are rounded
    await vi.advanceTimersByTimeAsync(0);
    expect(liveCalls(fetch.calls).map((c) => c.method)).toEqual(["POST", "POST"]); // truncate, create

    fetch.releaseCreate();
    store.dispatch({ type: "end", at: 3000 });
    await vi.advanceTimersByTimeAsync(10_000);

    expect(liveCalls(fetch.calls)).toEqual([
      { method: "POST", url: "/api/current-session/truncate", body: {} },
      {
        method: "POST",
        url: "/api/current-session",
        body: { driverName: "Kris", carName: "Buggy", locationName: "Backyard", lapCount: 0 },
      },
      {
        method: "PUT",
        url: "/api/current-session",
        body: { action: "addLap", sessionId: "live-1", lapNumber: 1, lapTime: 1000, penaltyCount: 2 },
      },
      {
        method: "PUT",
        url: "/api/current-session",
        body: { action: "addLap", sessionId: "live-1", lapNumber: 2, lapTime: 1500, penaltyCount: 0 },
      },
      { method: "DELETE", url: "/api/current-session", body: { sessionId: "live-1" } },
    ]);
    // The timer refuses writes that aren't JSON: the live record's five, and the LED display's.
    const writes = fetch.calls.filter((c) => c.method !== "GET");
    expect(writes.length).toBeGreaterThan(5);
    expect(writes.map((c) => c.type)).toEqual(Array(writes.length).fill("application/json"));
  });

  it("drives the LEDs and keeps going when a call fails", async () => {
    const calls: string[] = [];
    const impl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(init?.body ? `${init.method} ${url} ${String(init.body)}` : url);
      return new Response("{}", { status: url.startsWith("/api/led/text") ? 500 : 200 });
    });
    const store = createTimingStore();
    store.addEffect(integrationEffect(createPiIntegrations(impl as unknown as typeof globalThis.fetch)));

    store.dispatch({ type: "start", at: 0, id: "r", config });
    store.dispatch({ type: "lap", at: 1000 });
    await vi.advanceTimersByTimeAsync(5000);

    expect(calls).toContain("/api/ir/led/0/100/0");
    expect(calls).toContain('POST /api/led/rgb {"r":0,"g":255,"b":0}');
    expect(calls).toContain("/api/ir/led/100/0/0"); // lap flash, after the failed message
    expect(calls).toContain('POST /api/led/text {"title":"Session    Start","message":"Kris - Buggy at Backyard"}');
    expect(calls.filter((call) => call.startsWith("POST /api/led/text"))).toHaveLength(2);
  });
});
