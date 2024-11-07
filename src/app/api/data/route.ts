import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

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
          id: Date.now().toString(),
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
          id: Date.now().toString(),
          name: data.name,
          driverId: data.driverId,
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
          id: Date.now().toString(),
          name: data.name,
        },
      });
      return NextResponse.json({ success: true, location: newLocation });
    }

    if (data.sessions) {
      // Track processed sessions to prevent duplicates
      const processedIds = new Set<string>();
      const errors: Array<{ sessionId: string; error: string }> = [];

      // Process each session
      for (const session of data.sessions) {
        const sessionId = session.id?.toString() || Date.now().toString();

        // Skip if we've already processed this session
        if (processedIds.has(sessionId)) {
          continue;
        }
        processedIds.add(sessionId);

        try {
          // Validate existence of required relations before proceeding
          const [existingSession, driver, car, location] = await Promise.all([
            prisma.session.findUnique({
              where: { id: sessionId },
            }),
            prisma.driver.findUnique({
              where: { id: session.driverId },
            }),
            prisma.car.findUnique({
              where: { id: session.carId },
            }),
            prisma.location.findUnique({
              where: { id: session.locationId },
            }),
          ]);

          // Skip if session already exists
          if (existingSession) {
            continue;
          }

          // Validate all required relations exist
          if (!driver) {
            errors.push({ sessionId, error: `Driver with id ${session.driverId} not found` });
            continue;
          }
          if (!car) {
            errors.push({ sessionId, error: `Car with id ${session.carId} not found` });
            continue;
          }
          if (!location) {
            errors.push({ sessionId, error: `Location with id ${session.locationId} not found` });
            continue;
          }

          // Calculate total time
          const totalTime = Math.floor(typeof session.stats.totalTime === "string" ? parseInt(session.stats.totalTime) : session.stats.totalTime || 0);

          // Use transaction to ensure all related data is created atomically
          await prisma.$transaction(async (tx) => {
            // Create the session
            await tx.session.create({
              data: {
                id: sessionId,
                date: new Date(session.date),
                driver: {
                  connect: { id: session.driverId },
                },
                car: {
                  connect: { id: session.carId },
                },
                location: {
                  connect: { id: session.locationId },
                },
                driverName: session.driverName,
                carName: session.carName,
                locationName: session.locationName,
                totalTime,
                totalLaps: session.laps.length,
              },
            });

            // Create laps if they exist
            if (session.laps?.length > 0) {
              const lapsToCreate = session.laps.map((lap: any, index: number) => ({
                sessionId,
                lapNumber: typeof lap === "object" ? lap.lapNumber : index + 1,
                lapTime: Math.floor(typeof lap === "object" ? lap.lapTime : lap),
              }));

              await tx.lap.createMany({
                data: lapsToCreate,
              });
            }

            // Create penalties if they exist
            if (session.penalties?.length > 0) {
              await tx.penalty.createMany({
                data: session.penalties.map((penalty: any) => ({
                  sessionId,
                  lapNumber: penalty.lapNumber,
                  count: penalty.count || 0,
                })),
              });
            }
          });
        } catch (error) {
          errors.push({
            sessionId,
            error: error instanceof Error ? error.message : "Unknown error occurred",
          });
        }
      }

      // Return success with any errors that occurred
      return NextResponse.json({
        success: true,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    return NextResponse.json({ success: true });
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

    const { id, clearAll } = data;

    if (clearAll) {
      // Clear all sessions
      await prisma.$transaction([prisma.penalty.deleteMany({}), prisma.lap.deleteMany({}), prisma.session.deleteMany({})]);

      return NextResponse.json({
        success: true,
        message: "All sessions cleared",
      });
    }

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
        error: "Invalid delete request - missing id or clearAll parameter",
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
