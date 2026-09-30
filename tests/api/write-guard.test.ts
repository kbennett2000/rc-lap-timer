// Every route that changes the timer's data refuses other sites and bodies that aren't JSON (refuseWrite in
// src/lib/api-helpers.ts; the /api/sync routes check for themselves). The routes are found by reading the route files,
// so a new route that forgets the check fails here. Every request is refused before the route reads it, so nothing in
// the database changes.

import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BASE } from "./helpers";

const API_DIR = fileURLToPath(new URL("../../src/app/api", import.meta.url));

const writes = readdirSync(API_DIR, { recursive: true, encoding: "utf8" })
  .filter((file) => file.endsWith(`${sep}route.pi.ts`) || file === "route.pi.ts")
  .flatMap((file) => {
    const source = readFileSync(join(API_DIR, file), "utf8");
    const path = `/api/${file.split(sep).slice(0, -1).join("/")}`.replace(/\[[^\]]+\]/g, randomUUID());
    return [...source.matchAll(/export async function (POST|PUT|PATCH|DELETE)\b/g)].map(([, method]) => ({
      method,
      path,
    }));
  });

describe("the timer's write routes", () => {
  it("are all found", () => {
    expect(writes.length).toBeGreaterThanOrEqual(20);
  });

  it.each(writes)("$method $path refuses another site", async ({ method, path }) => {
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers: { Origin: "https://example.com", "Content-Type": "application/json" },
      body: "{}",
    });
    expect(response.status).toBe(403);
  });

  it.each(writes.filter(({ method }) => method !== "DELETE"))(
    "$method $path refuses a body that isn't JSON",
    async ({ method, path }) => {
      const response = await fetch(`${BASE}${path}`, {
        method,
        headers: { "Content-Type": "text/plain" },
        body: "{}",
      });
      expect(response.status).toBe(415);
    },
  );
});
