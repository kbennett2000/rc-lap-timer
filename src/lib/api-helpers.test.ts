import { describe, expect, it } from "vitest";
import { refuseWrite } from "./api-helpers";

const JSON_TYPE = { "content-type": "application/json" };

const request = (method: string, headers: Record<string, string>) =>
  new Request("https://rc-lap-timer/api/manage", { method, headers: { host: "rc-lap-timer", ...headers } });

const status = (method: string, headers: Record<string, string>) => refuseWrite(request(method, headers))?.status;

describe("refuseWrite", () => {
  it("lets the timer's own pages, and tools without an Origin, change data with JSON", () => {
    expect(status("POST", { origin: "https://rc-lap-timer", ...JSON_TYPE })).toBeUndefined();
    expect(
      status("PATCH", { origin: "https://rc-lap-timer", "content-type": "application/json; charset=utf-8" }),
    ).toBeUndefined();
    expect(status("PUT", JSON_TYPE)).toBeUndefined();
  });

  it("refuses other sites, the phone app's included: it changes the timer's data only through /api/sync", () => {
    expect(status("POST", { origin: "https://example.com", ...JSON_TYPE })).toBe(403);
    expect(status("DELETE", { origin: "https://example.com" })).toBe(403);
    expect(status("POST", { origin: "null", ...JSON_TYPE })).toBe(403);
    expect(status("POST", { origin: "https://kbennett2000.github.io", ...JSON_TYPE })).toBe(403);
    expect(status("POST", { origin: "https://rc-lap-timer.example.com", ...JSON_TYPE })).toBe(403);
  });

  it("refuses bodies that aren't JSON, which another site's form could send without asking", () => {
    expect(status("POST", { "content-type": "text/plain" })).toBe(415);
    expect(status("POST", { "content-type": "application/x-www-form-urlencoded" })).toBe(415);
    expect(status("PUT", { origin: "https://rc-lap-timer", "content-type": "multipart/form-data; boundary=x" })).toBe(
      415,
    );
    expect(status("PATCH", {})).toBe(415);
  });

  it("lets a DELETE without a body through", () => {
    expect(status("DELETE", { origin: "https://rc-lap-timer" })).toBeUndefined();
    expect(status("DELETE", {})).toBeUndefined();
  });
});
