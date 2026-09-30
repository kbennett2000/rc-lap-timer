import { NextResponse } from "next/server";
import { cleanCarNumber, cleanName, duplicateNameMessage } from "@/domain/rules";
import { badRequest, conflict, isPrismaError, notFound, readJson } from "@/lib/api-helpers";
import { prisma } from "@/lib/db";
import { deleteCar, deleteDriver, deleteLocation, deleteMotionSettings } from "@/lib/deletes";
import { logger } from "@/lib/logger";
import { renameOnSessions } from "@/lib/session-names";

// Renames (and car updates) keep the names stored on saved sessions in step, so history shows the new name.
// Each runs as one transaction.

async function renameDriver(id: string, newName: unknown) {
  const name = cleanName(newName, "driver");
  if (!name.ok) return badRequest(name.error);
  if (!(await prisma.driver.findUnique({ where: { id }, select: { id: true } }))) return notFound("Driver not found");
  if (await prisma.driver.findFirst({ where: { name: name.value, id: { not: id } } })) {
    return conflict(duplicateNameMessage("driver", name.value));
  }

  await prisma.$transaction([
    prisma.driver.update({ where: { id }, data: { name: name.value } }),
    renameOnSessions(prisma, "driver", id, name.value),
  ]);
  return NextResponse.json({ success: true });
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
    renameOnSessions(prisma, "car", id, name.value),
  ]);
  return NextResponse.json({ success: true, car: updatedCar });
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
    renameOnSessions(prisma, "location", id, name.value),
  ]);
  return NextResponse.json({ success: true });
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

// Deletes run as one transaction each; see src/lib/deletes.ts for what goes with each record.
const DELETES = {
  driver: { key: "driverId", label: "Driver", run: deleteDriver },
  car: { key: "carId", label: "Car", run: deleteCar },
  location: { key: "id", label: "Location", run: deleteLocation },
  motionSetting: { key: "id", label: "Motion setting", run: deleteMotionSettings },
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

    const found = await prisma.$transaction((tx) => run(tx, id));
    return found ? NextResponse.json({ success: true }) : notFound(`${label} not found`);
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
