import { beforeEach, describe, expect, it } from "vitest";
import {
  AutoSyncScheduler,
  exclusive,
  PULL_EVERY_MS,
  retryDelay,
  RETRY_MS,
  setSyncState,
  syncDue,
  syncState,
  type SyncRecord,
} from "./auto-sync";

describe("syncDue", () => {
  it("is due the first time, after a change, and after a while", () => {
    expect(syncDue(0, null, 0)).toBe(true);
    expect(syncDue(5, { count: 4, at: 1000 }, 2000)).toBe(true);
    expect(syncDue(5, { count: 5, at: 1000 }, 2000)).toBe(false);
    expect(syncDue(5, { count: 5, at: 1000 }, 1000 + PULL_EVERY_MS)).toBe(true);
  });
});

describe("retryDelay", () => {
  it("waits longer after each failure, up to the longest", () => {
    expect([1, 2, 3, 4, 5, 9].map(retryDelay)).toEqual([...RETRY_MS, RETRY_MS[3], RETRY_MS[3]]);
  });
});

describe("exclusive", () => {
  it("runs one sync at a time: a second caller gets the running one's result", async () => {
    let runs = 0;
    let finish!: (value: string) => void;
    const first = exclusive(() => {
      runs++;
      return new Promise<string>((resolve) => (finish = resolve));
    });
    const second = exclusive(async () => {
      runs++;
      return "second";
    });
    finish("first");
    expect(await first).toBe("first");
    expect(await second).toBe("first");
    expect(runs).toBe(1);
    expect(await exclusive(async () => "after")).toBe("after");
  });
});

describe("AutoSyncScheduler", () => {
  // A phone: its change count, the last sync's record, and a cloud that can be made to fail.
  function phone() {
    const world = {
      now: 1_000_000,
      count: 0,
      record: null as SyncRecord | null,
      ready: true,
      blocked: false,
      failWith: null as unknown,
      syncs: 0,
    };
    const scheduler = new AutoSyncScheduler({
      ready: () => world.ready,
      blocked: () => world.blocked,
      changeCount: async () => world.count,
      lastSync: () => world.record,
      now: () => world.now,
      sync: () =>
        exclusive(async () => {
          world.syncs++;
          if (world.failWith) throw world.failWith;
          world.record = { count: world.count, at: world.now };
        }),
    });
    return { world, scheduler };
  }

  beforeEach(() => setSyncState({ kind: "idle" }));

  it("syncs the first time, then only after a change", async () => {
    const { world, scheduler } = phone();
    await scheduler.check();
    expect(world.syncs).toBe(1);
    await scheduler.check();
    expect(world.syncs, "nothing changed").toBe(1);
    world.count = 3;
    await scheduler.check();
    expect(world.syncs).toBe(2);
  });

  it("brings in other phones' changes every 15 minutes", async () => {
    const { world, scheduler } = phone();
    await scheduler.check();
    world.now += PULL_EVERY_MS - 1;
    await scheduler.check();
    expect(world.syncs).toBe(1);
    world.now += 1;
    await scheduler.check();
    expect(world.syncs).toBe(2);
  });

  it("doesn't sync signed out or with the switch off", async () => {
    const { world, scheduler } = phone();
    world.ready = false;
    await scheduler.check();
    expect(world.syncs).toBe(0);
  });

  it("waits while a session is running or unsaved, then syncs", async () => {
    const { world, scheduler } = phone();
    world.blocked = true;
    await scheduler.check();
    expect(world.syncs).toBe(0);
    expect(syncState()).toEqual({ kind: "waiting", reason: "blocked" });
    world.blocked = false;
    await scheduler.check();
    expect(world.syncs).toBe(1);
    expect(syncState()).toEqual({ kind: "idle" });
  });

  it("after failing offline, waits before trying again, unless the connection comes back", async () => {
    const { world, scheduler } = phone();
    world.failWith = { code: "", message: "TypeError: Failed to fetch", status: 0 };
    world.count = 1;
    await scheduler.check();
    expect(world.syncs).toBe(1);
    expect(syncState()).toMatchObject({ kind: "waiting", reason: "offline" });
    world.failWith = null;
    world.now += RETRY_MS[0] - 1;
    await scheduler.check();
    expect(world.syncs, "still waiting").toBe(1);
    await scheduler.check({ connected: true });
    expect(world.syncs, "the connection is back").toBe(2);
    expect(world.record?.count).toBe(1);
  });

  it("waits longer after each failure", async () => {
    const { world, scheduler } = phone();
    world.failWith = { status: 503 };
    await scheduler.check();
    expect(syncState()).toMatchObject({ kind: "waiting", reason: "error", message: expect.stringMatching(/later/) });
    world.now += RETRY_MS[0];
    await scheduler.check();
    expect(world.syncs).toBe(2);
    world.now += RETRY_MS[1] - 1;
    await scheduler.check();
    expect(world.syncs, "the second wait is longer").toBe(2);
    world.now += 1;
    await scheduler.check();
    expect(world.syncs).toBe(3);
  });

  it("checks once at a time", async () => {
    const { world, scheduler } = phone();
    await Promise.all([scheduler.check(), scheduler.check(), scheduler.check()]);
    expect(world.syncs).toBe(1);
  });
});
