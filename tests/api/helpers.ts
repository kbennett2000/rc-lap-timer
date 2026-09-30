// Shared by the API tests: requests to the running server, and a Prisma client for what the API doesn't show.

import { PrismaClient } from "@prisma/client";
import { afterAll } from "vitest";

export const BASE = process.env.API_BASE_URL ?? "http://127.0.0.1:3100";

export const prisma = new PrismaClient();
afterAll(() => prisma.$disconnect());

// Response bodies are whatever the route returns; the assertions check their shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = any;

export async function call(method: string, path: string, body?: unknown): Promise<{ status: number; json: Json }> {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  const text = await response.text();
  let json: Json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { text };
  }
  return { status: response.status, json };
}

export async function createDriver(name: string): Promise<string> {
  return (await call("POST", "/api/data", { type: "driver", name })).json.driver.id;
}

export async function createCar(driverId: string, name: string, defaultCarNumber?: number): Promise<string> {
  return (await call("POST", "/api/data", { type: "car", name, driverId, defaultCarNumber })).json.car.id;
}

export async function createLocation(name: string): Promise<string> {
  return (await call("POST", "/api/data", { type: "location", name })).json.location.id;
}

// A finished race with one entry and one lap, written straight to the database (race mode needs IR hardware).
export async function addRace(locationId: string, driverId: string, carId: string, carNumber: number) {
  const race = await prisma.race.create({
    data: { name: "R", date: new Date(), locationId, status: "FINISHED", startDelay: 5 },
  });
  const entry = await addEntry(race.id, driverId, carId, carNumber);
  return { raceId: race.id, entryId: entry.id };
}

// An entry in a race, with one lap.
export async function addEntry(raceId: string, driverId: string, carId: string, carNumber: number) {
  const entry = await prisma.raceEntry.create({ data: { raceId, driverId, carId, carNumber } });
  await prisma.raceLap.create({
    data: { raceEntryId: entry.id, lapNumber: 1, lapTime: 10000, position: 1, gap: 0, timestamp: new Date() },
  });
  return entry;
}
