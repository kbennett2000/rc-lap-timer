// The DataStore backed by the Pi's API routes (/api/data, /api/manage, /api/motion-settings).

import type { Car, Driver, Lap, Location, MotionSettings, PenaltyData, SessionRecord } from "@/domain/types";
import { newId } from "@/lib/utils";
import { DataStoreError, type DataErrorKind, type DataStore } from "./types";

export interface ApiDataStoreOptions {
  // Prefix for the API paths: "" in the browser, the server's address in tests.
  baseUrl?: string;
  fetch?: typeof fetch;
}

// The API sends Prisma rows as JSON, with more fields than the domain types. These copy out the domain fields, so
// nothing else ends up in the screens' cache.

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);

function toCar(row: Car): Car {
  return {
    id: row.id,
    name: row.name,
    driverId: row.driverId,
    defaultCarNumber: row.defaultCarNumber ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toDriver(row: Driver): Driver {
  return {
    id: row.id,
    name: row.name,
    cars: (row.cars ?? []).map(toCar).sort(byName),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toLocation(row: Location): Location {
  return { id: row.id, name: row.name, createdAt: row.createdAt, updatedAt: row.updatedAt };
}

function toSession(row: SessionRecord): SessionRecord {
  return {
    id: row.id,
    date: row.date,
    driverId: row.driverId,
    driverName: row.driverName,
    carId: row.carId,
    carName: row.carName,
    locationId: row.locationId,
    locationName: row.locationName,
    laps: row.laps
      .map((lap: Lap) => ({ lapNumber: lap.lapNumber, lapTime: lap.lapTime }))
      .sort((a, b) => a.lapNumber - b.lapNumber),
    penalties: (row.penalties ?? []).map((p: PenaltyData) => ({ lapNumber: p.lapNumber, count: p.count })),
    totalTime: row.totalTime,
    totalLaps: row.totalLaps,
    notes: row.notes ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toMotionSettings(row: MotionSettings): MotionSettings {
  return {
    id: row.id,
    name: row.name,
    sensitivity: row.sensitivity,
    threshold: row.threshold,
    cooldown: row.cooldown,
    framesToSkip: row.framesToSkip,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// The routes answer 400 invalid, 404 not found and 409 duplicate name (see src/lib/api-helpers.ts).
function kindFor(status: number): DataErrorKind {
  if (status === 409) return "duplicate";
  if (status === 404) return "not-found";
  if (status >= 400 && status < 500) return "invalid";
  return "unavailable";
}

function messageFor(body: unknown, status: number): string {
  const { error, details } = (typeof body === "object" && body !== null ? body : {}) as {
    error?: unknown;
    details?: unknown;
  };
  if (typeof error !== "string") return `The lap timer couldn't do that (error ${status}). Please try again.`;
  return Array.isArray(details) && details.length > 0 ? `${error}: ${details.join("; ")}` : error;
}

export function createApiDataStore({
  baseUrl = "",
  // Wrapped: calling a stored reference to window.fetch throws "Illegal invocation".
  fetch: fetchImpl = (...args) => fetch(...args),
}: ApiDataStoreOptions = {}): DataStore {
  // Sends a request and returns the JSON body. A 404 on a delete counts as done: the record is gone either way.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- response bodies are checked by the to* mappers
  async function request(method: string, path: string, body?: unknown): Promise<any> {
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        ...(body !== undefined && {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      });
    } catch {
      throw new DataStoreError("unavailable", "Can't reach the lap timer. Check the Wi-Fi connection and try again.");
    }
    const json: unknown = await response.json().catch(() => ({}));
    if (response.ok) return json;
    if (method === "DELETE" && response.status === 404) return {};
    throw new DataStoreError(kindFor(response.status), messageFor(json, response.status));
  }

  return {
    async loadSnapshot() {
      const data = await request("GET", "/api/data");
      return {
        drivers: data.drivers.map(toDriver).sort(byName),
        locations: data.locations.map(toLocation).sort(byName),
        sessions: data.sessions.map(toSession),
      };
    },

    async createDriver(name) {
      return toDriver((await request("POST", "/api/data", { type: "driver", id: newId(), name })).driver);
    },
    async renameDriver(id, name) {
      await request("PATCH", "/api/manage", { type: "driver", id, newName: name });
    },
    async deleteDriver(id) {
      await request("DELETE", "/api/manage", { type: "driver", driverId: id });
    },

    async createCar({ driverId, name, defaultCarNumber }) {
      const body = { type: "car", id: newId(), driverId, name, defaultCarNumber };
      return toCar((await request("POST", "/api/data", body)).car);
    },
    async updateCar(id, { name, defaultCarNumber }) {
      // Always sends the number: the API keeps the old one when it's left out.
      await request("PATCH", "/api/manage", { type: "car", id, newName: name, defaultCarNumber });
    },
    async deleteCar(id) {
      await request("DELETE", "/api/manage", { type: "car", carId: id });
    },

    async createLocation(name) {
      return toLocation((await request("POST", "/api/data", { type: "location", id: newId(), name })).location);
    },
    async renameLocation(id, name) {
      await request("PATCH", "/api/manage", { type: "location", id, newName: name });
    },
    async deleteLocation(id) {
      await request("DELETE", "/api/manage", { type: "location", id });
    },

    async saveSession(session) {
      const result = await request("POST", "/api/data", { session });
      return { created: result.created !== false };
    },
    async updateSessionNotes(id, notes) {
      await request("PATCH", "/api/data", { sessionId: id, notes });
    },
    async deleteSession(id) {
      await request("DELETE", "/api/data", { id });
    },

    async listMotionSettings() {
      return ((await request("GET", "/api/motion-settings")) as MotionSettings[]).map(toMotionSettings);
    },
    async createMotionSettings(input) {
      return toMotionSettings(await request("POST", "/api/motion-settings", { id: newId(), ...input }));
    },
    async updateMotionSettings(id, input) {
      await request("PUT", "/api/motion-settings", { id, ...input });
    },
    async deleteMotionSettings(id) {
      await request("DELETE", `/api/motion-settings?id=${encodeURIComponent(id)}`);
    },
  };
}
