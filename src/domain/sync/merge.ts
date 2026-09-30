// Merges one set of app data into another: restoring a backup now, syncing phones and the Pi later. Pure: it returns
// the merged data and what changed, and the caller writes it. The rules:
//
// - Drivers, cars, locations and motion settings: the most recently changed version wins (updatedAt); on a tie the
//   local one is kept.
// - Sessions are only ever added. For a session both sides have, only the notes can change, and the more recent
//   notes win. The driver, car and location names on sessions always follow the records they belong to.
// - Deletes win: a record deleted on either side is deleted, with everything it cascades to.
// - Two records of the same kind with the same name (names are unique) are one record: the incoming one folds into
//   the local one, and an alias remembers that, so later merges from the same place land in the same record.
// - Sessions whose driver, car or location no longer exists are skipped.
// - Merging the same data twice changes nothing the second time.

import { nameKey } from "@/domain/rules";
import type { Car, Location, MotionSettings, SessionRecord } from "@/domain/types";
import type { Alias, BundleContents, DriverRecord, RecordKind, Tombstone } from "./bundle";

export interface KindSummary {
  added: number;
  updated: number;
  // Folded into a record with the same name.
  merged: number;
  deleted: number;
  // Left out: sessions whose driver, car or location is gone, and renames to a name another record has.
  skipped: number;
}

export type MergeSummary = Record<RecordKind, KindSummary>;

export interface MergeResult {
  merged: BundleContents;
  summary: MergeSummary;
}

const emptySummary = (): MergeSummary => ({
  driver: { added: 0, updated: 0, merged: 0, deleted: 0, skipped: 0 },
  car: { added: 0, updated: 0, merged: 0, deleted: 0, skipped: 0 },
  location: { added: 0, updated: 0, merged: 0, deleted: 0, skipped: 0 },
  session: { added: 0, updated: 0, merged: 0, deleted: 0, skipped: 0 },
  motionSettings: { added: 0, updated: 0, merged: 0, deleted: 0, skipped: 0 },
});

export function hasChanges(summary: MergeSummary): boolean {
  return Object.values(summary).some((kind) => kind.added + kind.updated + kind.merged + kind.deleted > 0);
}

// The same JSON, whatever order the keys are in.
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sameRecord(a: unknown, b: unknown): boolean {
  return stableJson(a) === stableJson(b);
}

const isNewer = (a: string, b: string) => Date.parse(a) > Date.parse(b);
const keyOf = (kind: RecordKind, id: string) => `${kind}:${id}`;

type Named = { id: string; name: string; updatedAt: string };

export function mergeBundles(
  local: BundleContents,
  incoming: BundleContents,
  now: string = new Date().toISOString(),
): MergeResult {
  const summary = emptySummary();

  // Aliases from both sides; a record's id is followed through them to the record it was folded into.
  const aliases = new Map<string, Alias>();
  for (const alias of [...local.aliases, ...incoming.aliases]) {
    if (!aliases.has(keyOf(alias.kind, alias.fromId))) aliases.set(keyOf(alias.kind, alias.fromId), alias);
  }
  const resolve = (kind: RecordKind, id: string): string => {
    const seen = new Set<string>();
    let current = id;
    while (aliases.has(keyOf(kind, current)) && !seen.has(current)) {
      seen.add(current);
      current = aliases.get(keyOf(kind, current))!.toId;
    }
    return current;
  };
  const addAlias = (kind: RecordKind, fromId: string, toId: string) => {
    if (fromId === toId) return;
    aliases.set(keyOf(kind, fromId), { kind, fromId, toId });
    deleted = null;
  };

  // Deletes from both sides (the earliest time wins, so the result doesn't depend on which side is local).
  const tombstones = new Map<string, Tombstone>();
  for (const tombstone of [...local.tombstones, ...incoming.tombstones]) {
    const existing = tombstones.get(keyOf(tombstone.kind, tombstone.id));
    if (!existing || isNewer(existing.deletedAt, tombstone.deletedAt)) {
      tombstones.set(keyOf(tombstone.kind, tombstone.id), tombstone);
    }
  }
  // The deleted records, by the id they resolve to now (worked out again when an alias is added).
  let deleted: Set<string> | null = null;
  const isDeleted = (kind: RecordKind, id: string) => {
    deleted ??= new Set([...tombstones.values()].map((t) => keyOf(t.kind, resolve(t.kind, t.id))));
    return deleted.has(keyOf(kind, resolve(kind, id)));
  };

  const drivers = new Map<string, DriverRecord>();
  const cars = new Map<string, Car>();
  const locations = new Map<string, Location>();
  const motionSettings = new Map<string, MotionSettings>();
  const sessions = new Map<string, SessionRecord>();

  // Merges named records into `records`: the local ones first (moved along their aliases), then the incoming ones,
  // which are the ones the summary counts. Deleted local records go in too, so the delete step below counts them.
  function mergeNamed<T extends Named>(
    kind: RecordKind,
    records: Map<string, T>,
    list: T[],
    counted: boolean,
    groupOf: (record: T) => string = () => "",
    check: (record: T) => boolean = () => true,
  ) {
    const nameIndex = () => new Map([...records.values()].map((r) => [`${groupOf(r)}\u0000${nameKey(r.name)}`, r.id]));
    for (const raw of list) {
      const record = { ...raw, id: resolve(kind, raw.id) };
      if (counted && isDeleted(kind, record.id)) continue;
      if (!check(record)) {
        if (counted) summary[kind].skipped++;
        continue;
      }
      const sameName = nameIndex().get(`${groupOf(record)}\u0000${nameKey(record.name)}`);
      const targetId = records.has(record.id) ? record.id : sameName;
      if (targetId === undefined) {
        records.set(record.id, record);
        if (counted) summary[kind].added++;
        continue;
      }
      if (targetId !== record.id) {
        // Same name, different record: fold it in, and keep its changes if they're newer.
        addAlias(kind, record.id, targetId);
        if (counted) summary[kind].merged++;
      }
      const existing = records.get(targetId)!;
      const candidate = { ...record, id: targetId };
      if (!isNewer(candidate.updatedAt, existing.updatedAt) || sameRecord(existing, candidate)) continue;
      if (sameName !== undefined && sameName !== targetId) {
        // A rename to a name another record already has.
        if (counted) summary[kind].skipped++;
        continue;
      }
      records.set(targetId, candidate);
      if (counted && targetId === record.id) summary[kind].updated++;
    }
  }

  const carGroup = (car: Car) => car.driverId;
  const withDriver = (car: Car) => ({ ...car, driverId: resolve("driver", car.driverId) });
  const driverExists = (car: Car) => drivers.has(car.driverId) || isDeleted("driver", car.driverId);

  mergeNamed("driver", drivers, local.data.drivers, false);
  mergeNamed("driver", drivers, incoming.data.drivers, true);
  mergeNamed("car", cars, local.data.cars.map(withDriver), false, carGroup);
  mergeNamed("car", cars, incoming.data.cars.map(withDriver), true, carGroup, driverExists);
  mergeNamed("location", locations, local.data.locations, false);
  mergeNamed("location", locations, incoming.data.locations, true);
  mergeNamed("motionSettings", motionSettings, local.data.motionSettings, false);
  mergeNamed("motionSettings", motionSettings, incoming.data.motionSettings, true);

  // Sessions: added once, and after that only their notes change.
  const mergeSessions = (list: SessionRecord[], counted: boolean) => {
    for (const raw of list) {
      const session: SessionRecord = {
        ...raw,
        id: resolve("session", raw.id),
        driverId: resolve("driver", raw.driverId),
        carId: resolve("car", raw.carId),
        locationId: resolve("location", raw.locationId),
      };
      if (counted && isDeleted("session", session.id)) continue;
      const existing = sessions.get(session.id);
      if (existing) {
        if (isNewer(session.updatedAt, existing.updatedAt) && existing.notes !== session.notes) {
          sessions.set(session.id, { ...existing, notes: session.notes, updatedAt: session.updatedAt });
          if (counted) summary.session.updated++;
        }
        continue;
      }
      const car = cars.get(session.carId);
      if (
        counted &&
        (!drivers.has(session.driverId) || car?.driverId !== session.driverId || !locations.has(session.locationId))
      ) {
        summary.session.skipped++;
        continue;
      }
      sessions.set(session.id, session);
      if (counted) summary.session.added++;
    }
  };
  mergeSessions(local.data.sessions, false);
  mergeSessions(incoming.data.sessions, true);

  // Deletes, and what they cascade to: a driver's cars, and the sessions of a deleted driver, car or location.
  const localIds = new Set<string>([
    ...local.data.drivers.map((r) => keyOf("driver", resolve("driver", r.id))),
    ...local.data.cars.map((r) => keyOf("car", resolve("car", r.id))),
    ...local.data.locations.map((r) => keyOf("location", resolve("location", r.id))),
    ...local.data.sessions.map((r) => keyOf("session", resolve("session", r.id))),
    ...local.data.motionSettings.map((r) => keyOf("motionSettings", resolve("motionSettings", r.id))),
  ]);
  const remove = <T extends { id: string }>(kind: RecordKind, records: Map<string, T>, gone: (r: T) => boolean) => {
    for (const record of [...records.values()]) {
      if (!gone(record)) continue;
      records.delete(record.id);
      if (!tombstones.has(keyOf(kind, record.id))) {
        tombstones.set(keyOf(kind, record.id), { kind, id: record.id, deletedAt: now });
      }
      if (localIds.has(keyOf(kind, record.id))) summary[kind].deleted++;
    }
  };
  remove("driver", drivers, (d) => isDeleted("driver", d.id));
  remove("car", cars, (c) => isDeleted("car", c.id) || !drivers.has(c.driverId));
  remove("location", locations, (l) => isDeleted("location", l.id));
  remove("motionSettings", motionSettings, (m) => isDeleted("motionSettings", m.id));
  remove(
    "session",
    sessions,
    (s) => isDeleted("session", s.id) || !cars.has(s.carId) || !drivers.has(s.driverId) || !locations.has(s.locationId),
  );

  // The names on sessions follow their records (a session's updatedAt only tracks its notes).
  for (const session of sessions.values()) {
    sessions.set(session.id, {
      ...session,
      driverName: drivers.get(session.driverId)!.name,
      carName: cars.get(session.carId)!.name,
      locationName: locations.get(session.locationId)!.name,
    });
  }

  return {
    merged: {
      data: {
        drivers: [...drivers.values()],
        cars: [...cars.values()],
        locations: [...locations.values()],
        sessions: [...sessions.values()],
        motionSettings: [...motionSettings.values()],
      },
      tombstones: [...tombstones.values()],
      aliases: [...aliases.values()],
    },
    summary,
  };
}

export interface TableWrites<T> {
  put: T[];
  remove: string[];
}

export interface Writes {
  drivers: TableWrites<DriverRecord>;
  cars: TableWrites<Car>;
  locations: TableWrites<Location>;
  sessions: TableWrites<SessionRecord>;
  motionSettings: TableWrites<MotionSettings>;
  tombstones: Tombstone[];
  aliases: Alias[];
}

function tableWrites<T extends { id: string }>(before: T[], after: T[]): TableWrites<T> {
  const old = new Map(before.map((r) => [r.id, r]));
  const kept = new Set(after.map((r) => r.id));
  return {
    put: after.filter((r) => !old.has(r.id) || !sameRecord(old.get(r.id), r)),
    remove: before.filter((r) => !kept.has(r.id)).map((r) => r.id),
  };
}

// The writes that turn `before` into `after`: only what changed.
export function planWrites(before: BundleContents, after: BundleContents): Writes {
  const knownTombstones = new Set(before.tombstones.map((t) => keyOf(t.kind, t.id)));
  const knownAliases = new Set(before.aliases.map((a) => `${keyOf(a.kind, a.fromId)}>${a.toId}`));
  return {
    drivers: tableWrites(before.data.drivers, after.data.drivers),
    cars: tableWrites(before.data.cars, after.data.cars),
    locations: tableWrites(before.data.locations, after.data.locations),
    sessions: tableWrites(before.data.sessions, after.data.sessions),
    motionSettings: tableWrites(before.data.motionSettings, after.data.motionSettings),
    tombstones: after.tombstones.filter((t) => !knownTombstones.has(keyOf(t.kind, t.id))),
    aliases: after.aliases.filter((a) => !knownAliases.has(`${keyOf(a.kind, a.fromId)}>${a.toId}`)),
  };
}
