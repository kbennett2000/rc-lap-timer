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

// In src/app/api/data/route.ts
export async function POST(request: Request) {
  try {
    const data = await request.json();

    // Track processed sessions to prevent duplicates
    const processedIds = new Set<string>();

    // Update sessions
    for (const session of data.sessions) {
      const sessionId = session.id?.toString() || Date.now().toString();

      // Skip if we've already processed this session
      if (processedIds.has(sessionId)) {
        console.log("Skipping duplicate session:", sessionId);
        continue;
      }
      processedIds.add(sessionId);

      console.log("Processing session:", sessionId);

      // Calculate total time
      const totalTime = Math.floor(typeof session.stats.totalTime === "string" ? parseInt(session.stats.totalTime) : session.stats.totalTime || 0);

      // First create/update the session
      await prisma.session.upsert({
        where: { id: sessionId },
        update: {
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
        create: {
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

      // Handle laps
      if (session.laps?.length > 0) {
        console.log("Processing laps for session:", sessionId);

        // Delete existing laps first
        await prisma.lap.deleteMany({
          where: { sessionId },
        });

        // Create new laps
        const lapsToCreate = session.laps.map((lap: any, index: number) => ({
          sessionId,
          lapNumber: typeof lap === "object" ? lap.lapNumber : index + 1,
          lapTime: Math.floor(typeof lap === "object" ? lap.lapTime : lap),
        }));

        console.log("Creating laps:", lapsToCreate);
        await prisma.lap.createMany({
          data: lapsToCreate,
        });
      }

      // Handle penalties similarly
      if (session.penalties?.length > 0) {
        await prisma.penalty.deleteMany({
          where: { sessionId },
        });

        await prisma.penalty.createMany({
          data: session.penalties.map((penalty: any) => ({
            sessionId,
            lapNumber: penalty.lapNumber,
            count: penalty.count || 0,
          })),
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving data:", error);
    return NextResponse.json(
      {
        error: "Error saving data",
        details: error.message,
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
    const data = await request.json();
    console.log("Delete request data:", data); // Debug log

    const { id, clearAll } = data;

    if (clearAll) {
      // Clear all sessions
      await prisma.penalty.deleteMany({});
      await prisma.lap.deleteMany({});
      await prisma.session.deleteMany({});
      return NextResponse.json({ success: true, message: "All sessions cleared" });
    } else if (id) {
      console.log("Deleting session with ID:", id); // Debug log

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
        details: error.message,
      },
      {
        status: 500,
      }
    );
  }
}
