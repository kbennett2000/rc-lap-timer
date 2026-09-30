import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchOk, newId } from "./utils";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("newId", () => {
  it("returns a v4 UUID", () => {
    expect(newId()).toMatch(UUID_V4);
  });

  it("falls back to getRandomValues outside secure contexts", () => {
    vi.stubGlobal("crypto", {
      randomUUID: undefined,
      getRandomValues: <T extends ArrayBufferView>(bytes: T) => bytes,
    });
    // All-zero random bytes still get the version and variant bits set.
    expect(newId()).toBe("00000000-0000-4000-8000-000000000000");
  });

  it("does not repeat", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId()));
    expect(ids.size).toBe(1000);
  });
});

describe("fetchOk", () => {
  it("returns the response on success", async () => {
    const response = new Response("{}", { status: 200 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(fetchOk("/api/x")).resolves.toBe(response);
  });

  it("throws on a non-2xx status, like axios did", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    await expect(fetchOk("/api/ir/led/0/0/0")).rejects.toThrow("GET /api/ir/led/0/0/0 failed (503)");
  });
});
