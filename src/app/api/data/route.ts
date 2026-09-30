import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

// Saves one finished practice session with its laps and penalties.
// Idempotent: posting a session id that already exists succeeds without changing anything, so clients can retry safely.
async function saveSession(session: any) {
  if (!isNonEmptyString(session?.id)) return badRequest("Session id is required");
  if (!isNonEmptyString(session.driverId) || !isNonEmptyString(session.carId) || !isNonEmptyString(session.locationId)) {
    return badRequest("Session driverId, carId and locationId are required");
  }
  const date = new Date(session.date);
  if (Number.isNaN(date.getTime())) return badRequest("Session date is invalid");
  if (!Array.isArray(session.laps)) return badRequest("Session laps must be an array");

  const laps = session.laps.map((lap: any, index: number) => ({
    lapNumber: typeof lap === "object" && Number.isInteger(lap?.lapNumber) ? lap.lapNumber : index + 1,
    lapTime: Math.round(Number(typeof lap === "object" ? lap?.lapTime : lap)),
  }));
  if (laps.some((lap: { lapTime: number }) => !Number.isFinite(lap.lapTime) || lap.lapTime < 0)) {
    return badRequest("Every lap needs a lap time of 0 ms or more");
  }

  const penalties = (Array.isArray(session.penalties) ? session.penalties : [])
    .filter((penalty: any) => Number.isInteger(penalty?.lapNumber) && Number.isInteger(penalty?.count) && penalty.count > 0)
    .map((penalty: any) => ({ lapNumber: penalty.lapNumber, count: penalty.count }));

  const existing = await prisma.session.findUnique({ where: { id: session.id }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ success: true, created: false });
  }

  const [driver, car, location] = await Promise.all([
    prisma.driver.findUnique({ where: { id: session.driverId } }),
    prisma.car.findUnique({ where: { id: session.carId } }),
    prisma.location.findUnique({ where: { id: session.locationId } }),
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
          totalTime: laps.reduce((sum: number, lap: { lapTime: number }) => sum + lap.lapTime, 0),
          totalLaps: laps.length,
        },
      });

      if (laps.length > 0) {
        await tx.lap.createMany({
          data: laps.map((lap: { lapNumber: number; lapTime: number }) => ({ sessionId: session.id, ...lap })),
        });
      }

      if (penalties.length > 0) {
        await tx.penalty.createMany({
          data: penalties.map((penalty: { lapNumber: number; count: number }) => ({ sessionId: session.id, ...penalty })),
        });
      }
    });
  } catch (error) {
    // Two retries of the same session can race; the loser sees a unique-id conflict, which means it is already saved.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ success: true, created: false });
    }
    throw error;
  }

  return NextResponse.json({ success: true, created: true });
}

export async function GET() {
  try {
    // Get all data with relationships
    const data = await prisma.$transaction([
      prisma.driver.findMany({
        include: {
          cars: true,
        },
      }),
      prisma.session.findMany({
        include: {
          driver: true,
          car: true,
          location: true, // Add location include
          laps: true,
          penalties: true,
        },
      }),
      prisma.location.findMany(), // Add locations query
    ]);

    return NextResponse.json({
      drivers: data[0],
      sessions: data[1],
      locations: data[2], // Add locations to response
    });
  } catch (error) {
    logger.error("Error reading data:", error);
    return NextResponse.json({ error: "Error reading data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const clonedRequest = request.clone();
    const data = await clonedRequest.json();

    // Handle driver creation
    if (data.type === "driver") {
      const newDriver = await prisma.driver.create({
        data: {
          name: data.name,
        },
        include: {
          cars: true,
        },
      });
      return NextResponse.json({ success: true, driver: newDriver });
    }

    // Handle car creation
    if (data.type === "car") {
      const newCar = await prisma.car.create({
        data: {
          name: data.name,
          driverId: data.driverId,
          defaultCarNumber: data.defaultCarNumber || null,
        },
        include: {
          driver: true,
        },
      });
      return NextResponse.json({ success: true, car: newCar });
    }

    // Handle location creation
    if (data.type === "location") {
      const newLocation = await prisma.location.create({
        data: {
          name: data.name,
        },
      });
      return NextResponse.json({ success: true, location: newLocation });
    }

    if (data.session) {
      return await saveSession(data.session);
    }

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
      { status: 500 }
    );
  }
}

// DELETE method to handle session deletion
export async function DELETE(request: Request) {
  try {
    const clonedRequest = request.clone();
    const data = await clonedRequest.json();

    const { id } = data;

    if (id) {
      try {
        // Delete specific session and its related data
        await prisma.$transaction([
          prisma.penalty.deleteMany({
            where: { sessionId: id },
          }),
          prisma.lap.deleteMany({
            where: { sessionId: id },
          }),
          prisma.session.delete({
            where: { id: id },
          }),
        ]);

        return NextResponse.json({
          success: true,
          message: `Session ${id} deleted successfully`,
        });
      } catch (prismaError) {
        logger.error("Prisma deletion error:", prismaError);

        // Check if this is a record not found error
        if ((prismaError as any).code === "P2025") {
          return NextResponse.json(
            {
              error: "Session not found",
              details: `No session found with ID ${id}`,
            },
            { status: 404 }
          );
        }

        throw prismaError; // Re-throw other Prisma errors
      }
    }

    return NextResponse.json(
      {
        error: "Invalid delete request - missing id",
      },
      { status: 400 }
    );
  } catch (error) {
    logger.error("Error in DELETE handler:", error);

    return NextResponse.json(
      {
        error: "Error deleting data",
        details: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    // Clone the request before reading
    const clonedRequest = request.clone();
    const { sessionId, notes } = await clonedRequest.json();

    const updatedSession = await prisma.session.update({
      where: { id: sessionId },
      data: { notes },
    });

    return NextResponse.json({ success: true, session: updatedSession });
  } catch (error) {
    logger.error("Error updating notes:", error);
    return NextResponse.json({ error: "Error updating notes", details: (error as Error).message }, { status: 500 });
  }
}
