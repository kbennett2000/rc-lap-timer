import { NextResponse } from "next/server";
import { cleanCarNumber, cleanName, cleanNotes } from "@/domain/rules";
import { badRequest, createOnce, isPrismaError, notFound, parseClientId, readJson } from "@/lib/api-helpers";
import { resolveId } from "@/lib/aliases";
import { prisma } from "@/lib/db";
import { deleteSession } from "@/lib/deletes";
import { logger } from "@/lib/logger";
import { parseSessionInput } from "@/lib/session-input";

export const dynamic = "force-dynamic";

// Saves one finished practice session with its laps and penalties.
// Idempotent: posting a session id that already exists succeeds without changing anything, so clients can retry safely.
// A session that was deleted isn't saved again either: a retry must not bring it back.
async function saveSession(input: unknown) {
  const parsed = parseSessionInput(input);
  if (!parsed.ok) return badRequest(parsed.error);
  const { session } = parsed;
  const { date, laps, penalties } = session;

  const [existing, buried] = await Promise.all([
    prisma.session.findUnique({ where: { id: session.id }, select: { id: true } }),
    prisma.tombstone.findUnique({ where: { kind_recordId: { kind: "session", recordId: session.id } } }),
  ]);
  if (existing || buried) {
    return NextResponse.json({ success: true, created: false });
  }

  // A save waiting since before a sync may name a driver, car or location that was merged into another.
  const [driver, car, location] = await Promise.all([
    resolveId(prisma, "driver", session.driverId).then((id) => prisma.driver.findUnique({ where: { id } })),
    resolveId(prisma, "car", session.carId).then((id) => prisma.car.findUnique({ where: { id } })),
    resolveId(prisma, "location", session.locationId).then((id) => prisma.location.findUnique({ where: { id } })),
  ]);
  if (!driver) return badRequest(`Driver ${session.driverId} not found`);
  if (!car || car.driverId !== driver.id) return badRequest(`Car ${session.carId} not found for this driver`);
  if (!location) return badRequest(`Location ${session.locationId} not found`);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.session.create({
        data: {
          id: session.id,
          date,
          driver: { connect: { id: driver.id } },
          car: { connect: { id: car.id } },
          location: { connect: { id: location.id } },
          driverName: driver.name,
          carName: car.name,
          locationName: location.name,
          totalTime: laps.reduce((sum, lap) => sum + lap.lapTime, 0),
          totalLaps: laps.length,
        },
      });

      if (laps.length > 0) {
        await tx.lap.createMany({
          data: laps.map((lap) => ({ sessionId: session.id, ...lap })),
        });
      }

      if (penalties.length > 0) {
        await tx.penalty.createMany({
          data: penalties.map((penalty) => ({ sessionId: session.id, ...penalty })),
        });
      }
    });
  } catch (error) {
    // Two retries of the same session can race; the loser sees a unique-id conflict, which means it is already saved.
    if (isPrismaError(error, "P2002")) {
      return NextResponse.json({ success: true, created: false });
    }
    throw error;
  }

  return NextResponse.json({ success: true, created: true });
}

async function createDriver(data: Record<string, unknown>) {
  const name = cleanName(data.name, "driver");
  if (!name.ok) return badRequest(name.error);
  const id = parseClientId(data.id);
  if (!id.ok) return badRequest(id.error);

  const result = await createOnce("driver", name.value, {
    findById: async () =>
      id.value ? prisma.driver.findUnique({ where: { id: id.value }, include: { cars: true } }) : null,
    nameTaken: async () => Boolean(await prisma.driver.findFirst({ where: { name: name.value } })),
    create: () => prisma.driver.create({ data: { id: id.value, name: name.value }, include: { cars: true } }),
  });
  if (result instanceof NextResponse) return result;
  return NextResponse.json({ success: true, created: result.created, driver: result.record });
}

async function createCar(data: Record<string, unknown>) {
  const name = cleanName(data.name, "car");
  if (!name.ok) return badRequest(name.error);
  const id = parseClientId(data.id);
  if (!id.ok) return badRequest(id.error);
  const driverId = typeof data.driverId === "string" ? data.driverId : "";
  if (!driverId || !(await prisma.driver.findUnique({ where: { id: driverId }, select: { id: true } }))) {
    return badRequest(`Driver ${driverId} not found`);
  }

  const result = await createOnce("car", name.value, {
    findById: async () => (id.value ? prisma.car.findUnique({ where: { id: id.value } }) : null),
    nameTaken: async () => Boolean(await prisma.car.findFirst({ where: { driverId, name: name.value } })),
    create: () =>
      prisma.car.create({
        data: { id: id.value, name: name.value, driverId, defaultCarNumber: cleanCarNumber(data.defaultCarNumber) },
      }),
  });
  if (result instanceof NextResponse) return result;
  return NextResponse.json({ success: true, created: result.created, car: result.record });
}

async function createLocation(data: Record<string, unknown>) {
  const name = cleanName(data.name, "location");
  if (!name.ok) return badRequest(name.error);
  const id = parseClientId(data.id);
  if (!id.ok) return badRequest(id.error);

  const result = await createOnce("location", name.value, {
    findById: async () => (id.value ? prisma.location.findUnique({ where: { id: id.value } }) : null),
    nameTaken: async () => Boolean(await prisma.location.findFirst({ where: { name: name.value } })),
    create: () => prisma.location.create({ data: { id: id.value, name: name.value } }),
  });
  if (result instanceof NextResponse) return result;
  return NextResponse.json({ success: true, created: result.created, location: result.record });
}

// Everything the practice screens show: drivers with their cars, saved sessions with their laps, and locations.
export async function GET() {
  try {
    const byName = { name: "asc" } as const;
    const byLap = { lapNumber: "asc" } as const;
    const [drivers, sessions, locations] = await prisma.$transaction([
      prisma.driver.findMany({ orderBy: byName, include: { cars: { orderBy: byName } } }),
      prisma.session.findMany({
        include: {
          laps: { orderBy: byLap },
          penalties: { orderBy: byLap },
        },
      }),
      prisma.location.findMany({ orderBy: byName }),
    ]);

    return NextResponse.json({ drivers, sessions, locations });
  } catch (error) {
    logger.error("Error reading data:", error);
    return NextResponse.json({ error: "Error reading data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await readJson(request);
    if (!data) return badRequest("Request body must be a JSON object");

    if (data.type === "driver") return await createDriver(data);
    if (data.type === "car") return await createCar(data);
    if (data.type === "location") return await createLocation(data);
    if (data.session) return await saveSession(data.session);

    // Earlier versions re-posted the whole session list on a timer, which brought deleted sessions back.
    if (data.sessions) {
      return badRequest("Uploading a list of sessions is no longer supported. Reload the app.");
    }

    return badRequest("Unknown request");
  } catch (error) {
    logger.error("Error saving data:", error);
    return NextResponse.json(
      {
        error: "Error saving data",
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}

// Deletes one saved session with its laps and penalties.
export async function DELETE(request: Request) {
  try {
    const data = await readJson(request);
    const id = data?.id;
    if (typeof id !== "string" || !id) return badRequest("Invalid delete request - missing id");

    const found = await prisma.$transaction((tx) => deleteSession(tx, id));
    if (!found) return notFound("Session not found");
    return NextResponse.json({ success: true, message: `Session ${id} deleted successfully` });
  } catch (error) {
    logger.error("Error in DELETE handler:", error);
    return NextResponse.json(
      {
        error: "Error deleting data",
        details: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    );
  }
}

// Sets or clears a saved session's notes.
export async function PATCH(request: Request) {
  try {
    const data = await readJson(request);
    const sessionId = data?.sessionId;
    if (typeof sessionId !== "string" || !sessionId) return badRequest("Session id is required");
    const notes = cleanNotes(data?.notes);
    if (!notes.ok) return badRequest(notes.error);

    const updatedSession = await prisma.session.update({
      where: { id: sessionId },
      data: { notes: notes.value },
    });

    return NextResponse.json({ success: true, session: updatedSession });
  } catch (error) {
    if (isPrismaError(error, "P2025")) return notFound("Session not found");
    logger.error("Error updating notes:", error);
    return NextResponse.json({ error: "Error updating notes", details: (error as Error).message }, { status: 500 });
  }
}
