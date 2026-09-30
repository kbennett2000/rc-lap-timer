import type { Prisma } from "@prisma/client";
import type { RecordKind } from "@/domain/sync/bundle";

// Deleting on the timer. A driver, car or location goes with everything recorded with it: sessions (with laps and
// penalties), session requests, and race entries (with their laps); a location also takes the races held there.
// Every foreign key is ON DELETE RESTRICT, so each cascade is spelled out here. Each delete leaves tombstones for
// what backups and sync carry (src/domain/sync), so a phone or an old backup can't bring it back.
// Run these inside a transaction; each returns false when the record doesn't exist.

type Tx = Prisma.TransactionClient;

const idsOf = (rows: { id: string }[]) => rows.map((row) => row.id);

// Records deletes. A record deleted twice keeps its first tombstone.
export async function bury(tx: Tx, kind: RecordKind, ids: string[], deletedAt = new Date()) {
  if (ids.length === 0) return;
  await tx.tombstone.createMany({
    data: ids.map((recordId) => ({ kind, recordId, deletedAt })),
    skipDuplicates: true,
  });
}

// Removes sessions with their laps and penalties, without tombstones (the caller records them).
export async function removeSessions(tx: Tx, ids: string[]) {
  if (ids.length === 0) return;
  await tx.penalty.deleteMany({ where: { sessionId: { in: ids } } });
  await tx.lap.deleteMany({ where: { sessionId: { in: ids } } });
  await tx.session.deleteMany({ where: { id: { in: ids } } });
}

async function deleteSessionsWhere(tx: Tx, where: Prisma.SessionWhereInput) {
  const ids = idsOf(await tx.session.findMany({ where, select: { id: true } }));
  await removeSessions(tx, ids);
  await bury(tx, "session", ids);
}

// The race-mode records of drivers, cars and locations. Backups don't carry them, so they leave no tombstones.
export async function removeRaceRecords(
  tx: Tx,
  {
    driverIds = [],
    carIds = [],
    locationIds = [],
  }: { driverIds?: string[]; carIds?: string[]; locationIds?: string[] },
) {
  const owners = [
    ...(driverIds.length > 0 ? [{ driverId: { in: driverIds } }] : []),
    ...(carIds.length > 0 ? [{ carId: { in: carIds } }] : []),
  ];
  if (owners.length > 0) {
    await tx.sessionRequest.deleteMany({ where: { OR: owners } });
    await tx.raceLap.deleteMany({ where: { raceEntry: { OR: owners } } });
    await tx.raceEntry.deleteMany({ where: { OR: owners } });
  }
  if (locationIds.length > 0) {
    await tx.sessionRequest.deleteMany({ where: { locationId: { in: locationIds } } });
    const raceIds = idsOf(await tx.race.findMany({ where: { locationId: { in: locationIds } }, select: { id: true } }));
    if (raceIds.length > 0) {
      await tx.raceLap.deleteMany({ where: { raceEntry: { raceId: { in: raceIds } } } });
      await tx.raceEntry.deleteMany({ where: { raceId: { in: raceIds } } });
      await tx.race.deleteMany({ where: { id: { in: raceIds } } });
    }
  }
}

// A driver's races are kept; only their own entries go.
export async function deleteDriver(tx: Tx, id: string): Promise<boolean> {
  if (!(await tx.driver.findUnique({ where: { id }, select: { id: true } }))) return false;
  const carIds = idsOf(await tx.car.findMany({ where: { driverId: id }, select: { id: true } }));
  await deleteSessionsWhere(tx, { OR: [{ driverId: id }, { carId: { in: carIds } }] });
  await removeRaceRecords(tx, { driverIds: [id], carIds });
  await tx.car.deleteMany({ where: { driverId: id } });
  await bury(tx, "car", carIds);
  await tx.driver.delete({ where: { id } });
  await bury(tx, "driver", [id]);
  return true;
}

export async function deleteCar(tx: Tx, id: string): Promise<boolean> {
  if (!(await tx.car.findUnique({ where: { id }, select: { id: true } }))) return false;
  await deleteSessionsWhere(tx, { carId: id });
  await removeRaceRecords(tx, { carIds: [id] });
  await tx.car.delete({ where: { id } });
  await bury(tx, "car", [id]);
  return true;
}

export async function deleteLocation(tx: Tx, id: string): Promise<boolean> {
  if (!(await tx.location.findUnique({ where: { id }, select: { id: true } }))) return false;
  await deleteSessionsWhere(tx, { locationId: id });
  await removeRaceRecords(tx, { locationIds: [id] });
  await tx.location.delete({ where: { id } });
  await bury(tx, "location", [id]);
  return true;
}

export async function deleteSession(tx: Tx, id: string): Promise<boolean> {
  if (!(await tx.session.findUnique({ where: { id }, select: { id: true } }))) return false;
  await removeSessions(tx, [id]);
  await bury(tx, "session", [id]);
  return true;
}

export async function deleteMotionSettings(tx: Tx, id: string): Promise<boolean> {
  if (!(await tx.motionSettings.findUnique({ where: { id }, select: { id: true } }))) return false;
  await tx.motionSettings.delete({ where: { id } });
  await bury(tx, "motionSettings", [id]);
  return true;
}
