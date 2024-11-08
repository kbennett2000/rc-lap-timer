import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

// Create a new current session
export async function POST(request: Request) {
  try {
    const data = await request.json();

    const currentSession = await prisma.currentSession.create({
      data: {
        driverName: data.driverName,
        carName: data.carName,
        locationName: data.locationName,
        lapCount: data.lapCount || 0,
      },
    });

    return NextResponse.json({ success: true, session: currentSession });
  } catch (error) {
    logger.error("Error creating current session:", error);
    return NextResponse.json({ error: "Error creating current session" }, { status: 500 });
  }
}

// Add a new lap to current session
export async function PUT(request: Request) {
  try {
    const data = await request.json();

    if (data.action === "addLap") {
      const newLap = await prisma.currentLap.create({
        data: {
          sessionId: data.sessionId,
          lapTime: data.lapTime,
          lapNumber: data.lapNumber,
          penaltyCount: data.penaltyCount || 0,
        },
      });

      return NextResponse.json({ success: true, lap: newLap });
    }

    if (data.action === "updateLap") {
      const updatedLap = await prisma.currentLap.update({
        where: { id: data.lapId },
        data: {
          lapTime: data.lapTime,
          lapNumber: data.lapNumber,
          penaltyCount: data.penaltyCount,
        },
      });

      return NextResponse.json({ success: true, lap: updatedLap });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    logger.error("Error managing current session lap:", error);
    return NextResponse.json({ error: "Error managing current session lap" }, { status: 500 });
  }
}

// Delete a current session and all its laps
export async function DELETE(request: Request) {
  try {
    const data = await request.json();

    // Thanks to onDelete: Cascade in the schema, deleting the session
    // will automatically delete all associated laps
    await prisma.currentSession.delete({
      where: { id: data.sessionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Error deleting current session:", error);
    return NextResponse.json({ error: "Error deleting current session" }, { status: 500 });
  }
}
