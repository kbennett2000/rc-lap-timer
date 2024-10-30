import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
          laps: true,
          penalties: true,
        },
      }),
    ]);

    return NextResponse.json({
      drivers: data[0],
      sessions: data[1],
    });
  } catch (error) {
    console.error("Error reading data:", error);
    return NextResponse.json({ error: "Error reading data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Clone the request before reading
    const clonedRequest = request.clone();
    const data = await clonedRequest.json();

    // Handle driver/car creation
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

    if (data.sessions) {
      // Track processed sessions to prevent duplicates
      const processedIds = new Set<string>();

      // Update sessions using transactions for atomicity
      for (const session of data.sessions) {
        const sessionId = session.id?.toString() || Date.now().toString();

        // Skip if we've already processed this session
        if (processedIds.has(sessionId)) {
          continue;
        }
        processedIds.add(sessionId);

        // Check if session already exists
        const existingSession = await prisma.session.findUnique({
          where: { id: sessionId },
        });

        if (existingSession) {
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
              driverName: session.driverName,
              carName: session.carName,
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
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving data:", error);
    return NextResponse.json(
      {
        error: "Error saving data",
        details: (error as Error).message,
      },
      {
        status: 500,
      }
    );
  }
}

// DELETE method to handle session deletion
export async function DELETE(request: Request) {
  try {
    // Clone the request before reading
    const clonedRequest = request.clone();
    const data = await clonedRequest.json();

    const { id, clearAll } = data;

    if (clearAll) {
      // Clear all sessions
      await prisma.penalty.deleteMany({});
      await prisma.lap.deleteMany({});
      await prisma.session.deleteMany({});
      return NextResponse.json({ success: true, message: "All sessions cleared" });
    } else if (id) {
      // Delete specific session and its related data
      await prisma.$transaction([
        prisma.penalty.deleteMany({
          where: { sessionId: id.toString() },
        }),
        prisma.lap.deleteMany({
          where: { sessionId: id.toString() },
        }),
        prisma.session.delete({
          where: { id: id.toString() },
        }),
      ]);

      return NextResponse.json({
        success: true,
        message: `Session ${id} deleted`,
      });
    }

    return NextResponse.json({ error: "Invalid delete request" }, { status: 400 });
  } catch (error) {
    console.error("Error in DELETE handler:", error); // Debug log
    return NextResponse.json(
      {
        error: "Error deleting data",
        details: (error as Error).message,
      },
      {
        status: 500,
      }
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
    console.error("Error updating notes:", error);
    return NextResponse.json({ error: "Error updating notes", details: (error as Error).message }, { status: 500 });
  }
}
