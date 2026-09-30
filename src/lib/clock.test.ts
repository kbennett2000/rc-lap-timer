import { beforeEach, describe, expect, it, vi } from "vitest";
import { CLOSE_ENOUGH_MS, compareClocks } from "./clock";

const helper = vi.hoisted(() => ({ installed: true, run: vi.fn<(args: string[]) => Promise<string>>() }));
const races = vi.hoisted(() => ({ count: vi.fn(async () => 0) }));

vi.mock("@/lib/config-helper", () => ({
  helperInstalled: async () => helper.installed,
  runHelper: helper.run,
  helperOutdated: (error: unknown) => String(error).includes("unknown command"),
}));
vi.mock("@/lib/db", () => ({ prisma: { race: races } }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const HOUR = 60 * 60_000;

// A fresh copy each time: the module remembers when the clock has been set.
const freshSyncClock = async () => {
  vi.resetModules();
  return (await import("./clock")).syncClock;
};

beforeEach(() => {
  helper.installed = true;
  helper.run.mockReset().mockResolvedValue("Clock set");
  races.count.mockReset().mockResolvedValue(0);
});

describe("compareClocks", () => {
  it("leaves clocks within two minutes alone", () => {
    expect(compareClocks(1_000_000 + CLOSE_ENOUGH_MS, 1_000_000)).toBe("close");
    expect(compareClocks(1_000_000 - CLOSE_ENOUGH_MS, 1_000_000)).toBe("close");
    expect(compareClocks(1_000_000 + CLOSE_ENOUGH_MS + 1, 1_000_000)).toBe("ahead");
    expect(compareClocks(1_000_000 - CLOSE_ENOUGH_MS - 1, 1_000_000)).toBe("behind");
  });
});

describe("syncClock", () => {
  it("sets the clock forward to a device's time, once", async () => {
    const syncClock = await freshSyncClock();
    const deviceNow = Date.now() + HOUR;
    expect(await syncClock(deviceNow)).toEqual({ changed: true, reason: "set" });
    expect(helper.run).toHaveBeenCalledWith(["set-clock", String(Math.floor(deviceNow / 1000))]);
    expect(await syncClock(Date.now() + 2 * HOUR)).toEqual({ changed: false, reason: "already-set" });
    expect(helper.run).toHaveBeenCalledTimes(1);
  });

  it("leaves it alone for a device that's close or behind, without asking the helper", async () => {
    const syncClock = await freshSyncClock();
    expect(await syncClock(Date.now() + 1000)).toEqual({ changed: false, reason: "close" });
    expect(await syncClock(Date.now() - HOUR)).toEqual({ changed: false, reason: "behind" });
    expect(helper.run).not.toHaveBeenCalled();
    expect(races.count).not.toHaveBeenCalled();
  });

  it("waits while a race started since boot is on", async () => {
    const syncClock = await freshSyncClock();
    races.count.mockResolvedValue(1);
    expect(await syncClock(Date.now() + HOUR)).toEqual({ changed: false, reason: "race" });
    const bootedAt = races.count.mock.calls[0] as unknown as [{ where: { updatedAt: { gte: Date } } }];
    expect(bootedAt[0].where.updatedAt.gte.getTime()).toBeLessThan(Date.now());
    races.count.mockResolvedValue(0);
    expect(await syncClock(Date.now() + HOUR)).toEqual({ changed: true, reason: "set" });
  });

  it("says when the helper already set it this boot, or can't", async () => {
    let syncClock = await freshSyncClock();
    helper.run.mockResolvedValue("Clock already set since boot");
    expect(await syncClock(Date.now() + HOUR)).toEqual({ changed: false, reason: "already-set" });

    syncClock = await freshSyncClock();
    helper.run.mockResolvedValue("Clock set");
    helper.installed = false;
    expect(await syncClock(Date.now() + HOUR)).toEqual({ changed: false, reason: "unavailable" });
    helper.installed = true;
    expect(await syncClock(Date.now() + HOUR)).toEqual({ changed: true, reason: "set" });

    syncClock = await freshSyncClock();
    helper.run.mockClear().mockRejectedValue(new Error("rc-config-helper: unknown command"));
    expect(await syncClock(Date.now() + HOUR)).toEqual({ changed: false, reason: "unavailable" });
    expect(await syncClock(Date.now() + HOUR)).toEqual({ changed: false, reason: "already-set" });
    expect(helper.run).toHaveBeenCalledTimes(1);
  });

  it("sets it only once when two devices ask together", async () => {
    const syncClock = await freshSyncClock();
    const answers = await Promise.all([syncClock(Date.now() + HOUR), syncClock(Date.now() + HOUR)]);
    expect(answers.map((a) => a.reason)).toEqual(["set", "already-set"]);
    expect(helper.run).toHaveBeenCalledTimes(1);
  });
});
