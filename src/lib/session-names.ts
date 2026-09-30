import type { Prisma, PrismaClient } from "@prisma/client";

// Saved sessions keep a copy of their driver's, car's and location's names, so history reads without joins.

const COLUMNS = {
  driver: { name: "driverName", id: "driverId" },
  car: { name: "carName", id: "carId" },
  location: { name: "locationName", id: "locationId" },
} as const;

// Puts a new name on the sessions recorded with a driver, car or location. Raw SQL on purpose: Prisma's updateMany
// would also move each session's updatedAt, which only a notes change may do (see src/domain/sync/merge.ts).
export function renameOnSessions(
  db: PrismaClient | Prisma.TransactionClient,
  kind: keyof typeof COLUMNS,
  id: string,
  name: string,
) {
  const column = COLUMNS[kind];
  return db.$executeRawUnsafe(`UPDATE \`Session\` SET \`${column.name}\` = ? WHERE \`${column.id}\` = ?`, name, id);
}
