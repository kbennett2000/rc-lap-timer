import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { cleanCarNumber, cleanName, duplicateNameMessage } from "@/domain/rules";
import { badRequest, conflict, isPrismaError, notFound, readJson } from "@/lib/api-helpers";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

// Renames (and car updates) keep the names stored on saved sessions in step, so history shows the new name.

async function listDriversAndSessions() {
  const [updatedDrivers, updatedSessions] = await Promise.all([
    prisma.driver.findMany({ include: { cars: true, sessions: { include: { laps: true, penalties: true } } } }),
    prisma.session.findMany({ include: { laps: true, penalties: true } }),
  ]);
  return { updatedDrivers, updatedSessions };
}

async function renameDriver(id: string, newName: unknown) {
  const name = cleanName(newName, "driver");
  if (!name.ok) return badRequest(name.error);
  if (!(await prisma.driver.findUnique({ where: { id }, select: { id: true } }))) return notFound("Driver not found");
  if (await prisma.driver.findFirst({ where: { name: name.value, id: { not: id } } })) {
    return conflict(duplicateNameMessage("driver", name.value));
  }

  await prisma.$transaction([
    prisma.driver.update({ where: { id }, data: { name: name.value } }),
    prisma.session.updateMany({ where: { driverId: id }, data: { driverName: name.value } }),
  ]);
  return NextResponse.json({ success: true, ...(await listDriversAndSessions()) });
}

// Renames a car and sets its default IR car number. Leaving defaultCarNumber out keeps the current number; null clears it.
async function updateCar(id: string, data: Record<string, unknown>) {
  const name = cleanName(data.newName, "car");
  if (!name.ok) return badRequest(name.error);
  const car = await prisma.car.findUnique({ where: { id }, select: { driverId: true } });
  if (!car) return notFound("Car not found");
  if (await prisma.car.findFirst({ where: { name: name.value, driverId: car.driverId, id: { not: id } } })) {
    return conflict(duplicateNameMessage("car", name.value));
  }

  const numberChange = "defaultCarNumber" in data ? { defaultCarNumber: cleanCarNumber(data.defaultCarNumber) } : {};
  const [updatedCar] = await prisma.$transaction([
    prisma.car.update({ where: { id }, data: { name: name.value, ...numberChange } }),
    prisma.session.updateMany({ where: { carId: id }, data: { carName: name.value } }),
  ]);
  const updatedDrivers = await prisma.driver.findMany({ include: { cars: true } });
  return NextResponse.json({ success: true, car: updatedCar, updatedDrivers });
}

async function renameLocation(id: string, newName: unknown) {
  const name = cleanName(newName, "location");
  if (!name.ok) return badRequest(name.error);
  if (!(await prisma.location.findUnique({ where: { id }, select: { id: true } }))) {
    return notFound("Location not found");
  }
  if (await prisma.location.findFirst({ where: { name: name.value, id: { not: id } } })) {
    return conflict(duplicateNameMessage("location", name.value));
  }

  await prisma.$transaction([
    prisma.location.update({ where: { id }, data: { name: name.value } }),
    prisma.session.updateMany({ where: { locationId: id }, data: { locationName: name.value } }),
  ]);
  const updatedLocations = await prisma.location.findMany();
  return NextResponse.json({ success: true, ...(await listDriversAndSessions()), updatedLocations });
}

async function renameMotionSetting(id: string, newName: unknown) {
  const name = cleanName(newName, "motionSetting");
  if (!name.ok) return badRequest(name.error);
  if (!(await prisma.motionSettings.findUnique({ where: { id }, select: { id: true } }))) {
    return notFound("Motion setting not found");
  }
  if (await prisma.motionSettings.findFirst({ where: { name: name.value, id: { not: id } } })) {
    return conflict(duplicateNameMessage("motionSetting", name.value));
  }

  await prisma.motionSettings.update({ where: { id }, data: { name: name.value } });
  return NextResponse.json({ success: true });
}

export async function PATCH(request: Request) {
  try {
    const data = await readJson(request);
    if (!data) return badRequest("Request body must be a JSON object");
    const { type, id } = data;
    if (typeof id !== "string" || !id) return badRequest("id is required");

    switch (type) {
      case "driver":
        return await renameDriver(id, data.newName);
      case "car":
        return await updateCar(id, data);
      case "location":
        return await renameLocation(id, data.newName);
      case "motionSetting":
        return await renameMotionSetting(id, data.newName);
      default:
        return badRequest(`Unknown type: ${String(type)}`);
    }
  } catch (error) {
    // Two renames to the same name can race past the checks above; the database's unique index catches the second.
    if (isPrismaError(error, "P2002")) return conflict("That name is already in use");
    logger.error("Error updating:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update",
      },
      { status: 500 },
    );
  }
}

// Deleting a driver, car or location also deletes everything recorded with it: sessions (with laps and penalties),
// session requests, and race entries (with their laps). Deleting a location also deletes the races held there.
// Every foreign key is ON DELETE RESTRICT, so each cascade is spelled out here and runs as one transaction.

async function deleteSessionsWhere(tx: Prisma.TransactionClient, where: Prisma.SessionWhereInput) {
  const sessionIds = (await tx.session.findMany({ where, select: { id: true } })).map((s) => s.id);
  if (sessionIds.length > 0) {
    await tx.penalty.deleteMany({ where: { sessionId: { in: sessionIds } } });
    await tx.lap.deleteMany({ where: { sessionId: { in: sessionIds } } });
  }
  await tx.session.deleteMany({ where });
}

async function deleteLocation(id: string) {
  await prisma.$transaction(async (tx) => {
    await deleteSessionsWhere(tx, { locationId: id });
    await tx.sessionRequest.deleteMany({ where: { locationId: id } });

    const raceIds = (await tx.race.findMany({ where: { locationId: id }, select: { id: true } })).map((r) => r.id);
    if (raceIds.length > 0) {
      await tx.raceLap.deleteMany({ where: { raceEntry: { raceId: { in: raceIds } } } });
      await tx.raceEntry.deleteMany({ where: { raceId: { in: raceIds } } });
      await tx.race.deleteMany({ where: { id: { in: raceIds } } });
    }

    await tx.location.delete({ where: { id } });
  });

  const [updatedDrivers, updatedLocations] = await Promise.all([
    prisma.driver.findMany({ include: { cars: true } }),
    prisma.location.findMany(),
  ]);
  return NextResponse.json({ success: true, updatedDrivers, updatedLocations });
}

// A driver's races are kept; only their own entries go.
async function deleteDriver(driverId: string) {
  await prisma.$transaction(async (tx) => {
    const carIds = (await tx.car.findMany({ where: { driverId }, select: { id: true } })).map((c) => c.id);
    const raceEntryFilter = { OR: [{ driverId }, { carId: { in: carIds } }] };

    await deleteSessionsWhere(tx, { carId: { in: carIds } });
    await tx.sessionRequest.deleteMany({ where: raceEntryFilter });
    await tx.raceLap.deleteMany({ where: { raceEntry: raceEntryFilter } });
    await tx.raceEntry.deleteMany({ where: raceEntryFilter });
    await tx.car.deleteMany({ where: { driverId } });
    await tx.driver.delete({ where: { id: driverId } });
  });
  return NextResponse.json({
    success: true,
    updatedDrivers: await prisma.driver.findMany({ include: { cars: true } }),
  });
}

async function deleteCar(carId: string) {
  await prisma.$transaction(async (tx) => {
    await deleteSessionsWhere(tx, { carId });
    await tx.sessionRequest.deleteMany({ where: { carId } });
    await tx.raceLap.deleteMany({ where: { raceEntry: { carId } } });
    await tx.raceEntry.deleteMany({ where: { carId } });
    await tx.car.delete({ where: { id: carId } });
  });
  return NextResponse.json({
    success: true,
    updatedDrivers: await prisma.driver.findMany({ include: { cars: true } }),
  });
}

async function deleteMotionSetting(id: string) {
  await prisma.motionSettings.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

const DELETES = {
  driver: { key: "driverId", label: "Driver", run: deleteDriver },
  car: { key: "carId", label: "Car", run: deleteCar },
  location: { key: "id", label: "Location", run: deleteLocation },
  motionSetting: { key: "id", label: "Motion setting", run: deleteMotionSetting },
} as const;

export async function DELETE(request: Request) {
  try {
    const data = await readJson(request);
    if (!data) return badRequest("Request body must be a JSON object");
    const type = data.type;
    if (typeof type !== "string" || !Object.hasOwn(DELETES, type)) {
      return badRequest(`Unknown type: ${String(type)}`);
    }

    // Drivers are named by driverId, cars by carId, locations and motion settings by id.
    const { key, label, run } = DELETES[type as keyof typeof DELETES];
    const id = data[key];
    if (typeof id !== "string" || !id) return badRequest(`${key} is required`);

    try {
      return await run(id);
    } catch (error) {
      if (isPrismaError(error, "P2025")) return notFound(`${label} not found`);
      throw error;
    }
  } catch (error) {
    logger.error("Error deleting:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete",
      },
      { status: 500 },
    );
  }
}
