import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import {
  BUNDLE_FORMAT,
  BUNDLE_SCHEMA_VERSION,
  type Bundle,
  type BundleContents,
  type RecordKind,
} from "@/domain/sync/bundle";
import { mergeBundles, planWrites, type MergeSummary } from "@/domain/sync/merge";
import type { SessionRecord } from "@/domain/types";
import { prisma } from "@/lib/db";
import { bury, removeRaceRecords, removeSessions } from "@/lib/deletes";

// Backups and sync on the timer, in the format the phone app uses (src/domain/sync): the timer's data as a bundle,
// and a bundle merged into it with the same rules the phone follows.

type Tx = Prisma.TransactionClient;

const iso = (date: Date) => date.toISOString();
const stamps = (row: { createdAt: Date; updatedAt: Date }) => ({
  createdAt: iso(row.createdAt),
  updatedAt: iso(row.updatedAt),
});
const dates = (record: { createdAt: string; updatedAt: string }) => ({
  createdAt: new Date(record.createdAt),
  updatedAt: new Date(record.updatedAt),
});
const byLap = { lapNumber: "asc" } as const;

// Everything stored, shaped exactly as the phone stores it, so an unchanged record never looks changed to the merge.
export async function readContents(tx: Tx): Promise<BundleContents> {
  const [drivers, cars, locations, sessions, motionSettings, tombstones, aliases] = await Promise.all([
    tx.driver.findMany(),
    tx.car.findMany(),
    tx.location.findMany(),
    tx.session.findMany({ include: { laps: { orderBy: byLap }, penalties: { orderBy: byLap } } }),
    tx.motionSettings.findMany(),
    tx.tombstone.findMany(),
    tx.idAlias.findMany(),
  ]);
  return {
    data: {
      drivers: drivers.map((d) => ({ id: d.id, name: d.name, ...stamps(d) })),
      cars: cars.map((c) => ({
        id: c.id,
        name: c.name,
        driverId: c.driverId,
        defaultCarNumber: c.defaultCarNumber,
        ...stamps(c),
      })),
      locations: locations.map((l) => ({ id: l.id, name: l.name, ...stamps(l) })),
      sessions: sessions.map((s): SessionRecord => ({
        id: s.id,
        date: iso(s.date),
        driverId: s.driverId,
        driverName: s.driverName,
        carId: s.carId,
        carName: s.carName,
        locationId: s.locationId,
        locationName: s.locationName,
        laps: s.laps.map(({ lapNumber, lapTime }) => ({ lapNumber, lapTime })),
        penalties: s.penalties.map(({ lapNumber, count }) => ({ lapNumber, count })),
        totalTime: s.totalTime,
        totalLaps: s.totalLaps,
        notes: s.notes,
        ...stamps(s),
      })),
      motionSettings: motionSettings.map((m) => ({
        id: m.id,
        name: m.name,
        sensitivity: m.sensitivity,
        threshold: m.threshold,
        cooldown: m.cooldown,
        framesToSkip: m.framesToSkip,
        ...stamps(m),
      })),
    },
    tombstones: tombstones.map((t) => ({ kind: t.kind as RecordKind, id: t.recordId, deletedAt: iso(t.deletedAt) })),
    aliases: aliases.map((a) => ({ kind: a.kind as RecordKind, fromId: a.fromId, toId: a.toId })),
  };
}

// The timer names itself once, so merged data can tell where it came from.
async function deviceId(tx: Tx): Promise<string> {
  const row = await tx.syncMeta.upsert({
    where: { key: "deviceId" },
    create: { key: "deviceId", value: randomUUID() },
    update: {},
  });
  return row.value;
}

export async function timerId(): Promise<string> {
  return prisma.$transaction((tx) => deviceId(tx));
}

export async function exportBundle(): Promise<Bundle> {
  return prisma.$transaction(async (tx) => ({
    format: BUNDLE_FORMAT,
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    deviceId: await deviceId(tx),
    ...(await readContents(tx)),
  }));
}

export async function lastBackupAt(): Promise<string | null> {
  return (await prisma.syncMeta.findUnique({ where: { key: "lastBackupAt" } }))?.value ?? null;
}

export async function markBackedUp(at: string) {
  await prisma.syncMeta.upsert({
    where: { key: "lastBackupAt" },
    create: { key: "lastBackupAt", value: at },
    update: { value: at },
  });
}

// Moves the race-mode records of a driver, car or location that was merged into another with the same name. A race
// entry whose race already has one for the other driver goes, with its laps: a driver races once per race.
async function moveRaceRecords(tx: Tx, kind: "driver" | "car" | "location", fromId: string, toId: string) {
  if (kind === "driver") {
    await tx.sessionRequest.updateMany({ where: { driverId: fromId }, data: { driverId: toId } });
    const taken = await tx.raceEntry.findMany({ where: { driverId: toId }, select: { raceId: true } });
    const clashes = { driverId: fromId, raceId: { in: taken.map((entry) => entry.raceId) } };
    await tx.raceLap.deleteMany({ where: { raceEntry: clashes } });
    await tx.raceEntry.deleteMany({ where: clashes });
    await tx.raceEntry.updateMany({ where: { driverId: fromId }, data: { driverId: toId } });
  } else if (kind === "car") {
    await tx.sessionRequest.updateMany({ where: { carId: fromId }, data: { carId: toId } });
    await tx.raceEntry.updateMany({ where: { carId: fromId }, data: { carId: toId } });
  } else {
    await tx.sessionRequest.updateMany({ where: { locationId: fromId }, data: { locationId: toId } });
    await tx.race.updateMany({ where: { locationId: fromId }, data: { locationId: toId } });
  }
}

// Writes a merge. The order matters: every foreign key is ON DELETE RESTRICT, and names are unique.
async function applyMerge(tx: Tx, before: BundleContents, merged: BundleContents) {
  const writes = planWrites(before, merged);
  const foldedInto = new Map(merged.aliases.map((a) => [`${a.kind}:${a.fromId}`, a.toId]));

  // 1. Sessions that go (their tombstones come with the merge).
  await removeSessions(tx, writes.sessions.remove);

  // 2. Records that go or change their name first step aside to a name nobody has, so no name meets itself on the
  // way to another record (a rename to a name another record is giving up, or two records swapping names).
  const renamed = <T extends { id: string; name: string }>(old: T[], puts: T[]) => {
    const names = new Map(old.map((r) => [r.id, r.name]));
    return puts.filter((r) => names.has(r.id) && names.get(r.id) !== r.name).map((r) => r.id);
  };
  const park = (id: string) => ({ where: { id }, data: { name: `sync-parked:${id}` } });
  for (const id of [...writes.drivers.remove, ...renamed(before.data.drivers, writes.drivers.put)]) {
    await tx.driver.update(park(id));
  }
  for (const id of [...writes.cars.remove, ...renamed(before.data.cars, writes.cars.put)]) {
    await tx.car.update(park(id));
  }
  for (const id of [...writes.locations.remove, ...renamed(before.data.locations, writes.locations.put)]) {
    await tx.location.update(park(id));
  }
  for (const id of [
    ...writes.motionSettings.remove,
    ...renamed(before.data.motionSettings, writes.motionSettings.put),
  ]) {
    await tx.motionSettings.update(park(id));
  }

  // 3. Drivers, locations and motion settings, then cars (which need their driver).
  for (const { id, ...driver } of writes.drivers.put) {
    const row = { name: driver.name, ...dates(driver) };
    await tx.driver.upsert({ where: { id }, create: { id, ...row }, update: row });
  }
  for (const { id, ...location } of writes.locations.put) {
    const row = { name: location.name, ...dates(location) };
    await tx.location.upsert({ where: { id }, create: { id, ...row }, update: row });
  }
  for (const { id, ...settings } of writes.motionSettings.put) {
    const row = { ...settings, ...dates(settings) };
    await tx.motionSettings.upsert({ where: { id }, create: { id, ...row }, update: row });
  }
  for (const { id, ...car } of writes.cars.put) {
    const row = { ...car, ...dates(car) };
    await tx.car.upsert({ where: { id }, create: { id, ...row }, update: row });
  }

  // 4. Sessions: new ones with their laps and penalties; for the rest, notes, names and moved references.
  const had = new Set(before.data.sessions.map((s) => s.id));
  const added = writes.sessions.put.filter((s) => !had.has(s.id));
  const row = ({ laps: _laps, penalties: _penalties, ...session }: SessionRecord) => ({
    ...session,
    date: new Date(session.date),
    ...dates(session),
  });
  if (added.length > 0) {
    await tx.session.createMany({ data: added.map(row) });
    const laps = added.flatMap((s) => s.laps.map((lap) => ({ sessionId: s.id, ...lap })));
    const penalties = added.flatMap((s) => s.penalties.map((penalty) => ({ sessionId: s.id, ...penalty })));
    if (laps.length > 0) await tx.lap.createMany({ data: laps });
    if (penalties.length > 0) await tx.penalty.createMany({ data: penalties });
  }
  for (const session of writes.sessions.put.filter((s) => had.has(s.id))) {
    const { id, ...changes } = row(session);
    await tx.session.update({ where: { id }, data: changes });
  }

  // 5. Drivers, cars and locations that go: race-mode records move to the record a merged one went into, and go
  // with a deleted one. Then the records themselves, cars before their drivers.
  for (const [kind, ids] of [
    ["driver", writes.drivers.remove],
    ["car", writes.cars.remove],
    ["location", writes.locations.remove],
  ] as const) {
    const deleted: string[] = [];
    for (const id of ids) {
      const target = foldedInto.get(`${kind}:${id}`);
      if (target) await moveRaceRecords(tx, kind, id, target);
      else deleted.push(id);
    }
    await removeRaceRecords(tx, {
      driverIds: kind === "driver" ? deleted : [],
      carIds: kind === "car" ? deleted : [],
      locationIds: kind === "location" ? deleted : [],
    });
  }
  await tx.car.deleteMany({ where: { id: { in: writes.cars.remove } } });
  await tx.driver.deleteMany({ where: { id: { in: writes.drivers.remove } } });
  await tx.location.deleteMany({ where: { id: { in: writes.locations.remove } } });
  await tx.motionSettings.deleteMany({ where: { id: { in: writes.motionSettings.remove } } });

  // 6. What the merge learned: deletes and merged records.
  for (const tombstone of writes.tombstones) {
    await bury(tx, tombstone.kind, [tombstone.id], new Date(tombstone.deletedAt));
  }
  for (const { kind, fromId, toId } of writes.aliases) {
    await tx.idAlias.upsert({
      where: { kind_fromId: { kind, fromId } },
      create: { kind, fromId, toId },
      update: { toId },
    });
  }
}

// One import at a time: each reads everything, merges, and writes the difference.
let importing: Promise<unknown> = Promise.resolve();

// Merges a bundle into the timer's data in one transaction, and says what changed. With dryRun, only says.
export function importBundle(bundle: BundleContents, { dryRun = false } = {}): Promise<MergeSummary> {
  const run = importing.then(() =>
    prisma.$transaction(
      async (tx) => {
        const before = await readContents(tx);
        const { merged, summary } = mergeBundles(before, bundle, new Date().toISOString());
        if (!dryRun) await applyMerge(tx, before, merged);
        return summary;
      },
      { maxWait: 10_000, timeout: 120_000 },
    ),
  );
  importing = run.catch(() => {});
  return run;
}
