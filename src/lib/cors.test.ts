import { afterEach, describe, expect, it, vi } from "vitest";
import { allowedOrigins, corsHeaders, preflight, refusedOrigin, withCors } from "./cors";

const request = (headers: Record<string, string>, method = "GET") =>
  new Request("http://192.168.4.1/api/sync", { method, headers: { host: "192.168.4.1", ...headers } });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("allowedOrigins", () => {
  it("is the phone app's site unless the timer's settings name others", () => {
    expect(allowedOrigins(undefined)).toEqual(["https://kbennett2000.github.io"]);
    expect(allowedOrigins(" https://me.github.io/ , http://127.0.0.1:3200")).toEqual([
      "https://me.github.io",
      "http://127.0.0.1:3200",
    ]);
    expect(allowedOrigins(" , ")).toEqual(["https://kbennett2000.github.io"]);
  });
});

describe("CORS for the sync routes", () => {
  it("lets the phone app read responses, and nobody else", () => {
    expect(corsHeaders(request({ origin: "https://kbennett2000.github.io" }))).toEqual({
      "Access-Control-Allow-Origin": "https://kbennett2000.github.io",
      Vary: "Origin",
    });
    expect(corsHeaders(request({ origin: "https://example.com" }))).toEqual({});
    const response = withCors(request({ origin: "https://example.com" }), Response.json({}));
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(response.headers.get("Vary")).toBe("Origin");
  });

  it("answers the phone app's preflight, including Chrome's private network check", () => {
    const answer = preflight(
      request(
        {
          origin: "https://kbennett2000.github.io",
          "access-control-request-method": "POST",
          "access-control-request-private-network": "true",
        },
        "OPTIONS",
      ),
    );
    expect(answer.status).toBe(204);
    expect(answer.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST");
    expect(answer.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
    expect(answer.headers.get("Access-Control-Allow-Private-Network")).toBe("true");
    expect(preflight(request({ origin: "https://example.com" }, "OPTIONS")).status).toBe(403);
  });

  it("refuses writes from other sites, but not from the timer's own pages or tools without an Origin", () => {
    expect(refusedOrigin(request({ origin: "https://example.com" }, "POST"))).toBe(true);
    expect(refusedOrigin(request({ origin: "https://kbennett2000.github.io" }, "POST"))).toBe(false);
    expect(refusedOrigin(request({ origin: "https://192.168.4.1" }, "POST"))).toBe(false);
    expect(refusedOrigin(request({}, "POST"))).toBe(false);
    vi.stubEnv("SYNC_ALLOWED_ORIGINS", "https://me.github.io");
    expect(refusedOrigin(request({ origin: "https://kbennett2000.github.io" }, "POST"))).toBe(true);
  });
});
