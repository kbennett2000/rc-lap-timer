import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

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

export async function PUT(request: Request) {
  try {
    const data = await request.json();

    if (data.action === "addLap") {
      // First verify the session exists
      const existingSession = await prisma.currentSession.findUnique({
        where: { id: data.sessionId },
      });

      if (!existingSession) {
        return NextResponse.json(
          {
            error: "Session not found",
            details: `No current session found with ID: ${data.sessionId}`,
          },
          { status: 404 }
        );
      }

      // Get the next lap number
      const lastLap = await prisma.currentLap.findFirst({
        where: { sessionId: data.sessionId },
        orderBy: { lapNumber: "desc" },
      });

      const nextLapNumber = (lastLap?.lapNumber ?? 0) + 1;

      // Create new lap with the calculated lap number
      const newLap = await prisma.currentLap.create({
        data: {
          sessionId: data.sessionId,
          lapTime: data.lapTime,
          penaltyCount: data.penaltyCount || 0,
          lapNumber: nextLapNumber,
        },
      });

      return NextResponse.json({ success: true, lap: newLap });
    }

    if (data.action === "updateLap") {
      // Verify the lap exists
      const existingLap = await prisma.currentLap.findUnique({
        where: { id: data.lapId },
      });

      if (!existingLap) {
        return NextResponse.json(
          {
            error: "Lap not found",
            details: `No lap found with ID: ${data.lapId}`,
          },
          { status: 404 }
        );
      }

      const updatedLap = await prisma.currentLap.update({
        where: { id: data.lapId },
        data: {
          lapTime: data.lapTime,
          penaltyCount: data.penaltyCount,
        },
      });

      return NextResponse.json({ success: true, lap: updatedLap });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    logger.error("Error managing current session lap:", error);
    return NextResponse.json(
      {
        error: "Error managing current session lap",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const data = await request.json();

    // Verify the session exists
    const existingSession = await prisma.currentSession.findUnique({
      where: { id: data.sessionId },
    });

    if (!existingSession) {
      return NextResponse.json(
        {
          error: "Session not found",
          details: `No current session found with ID: ${data.sessionId}`,
        },
        { status: 404 }
      );
    }

    // Delete session (this will cascade delete all laps)
    await prisma.currentSession.delete({
      where: { id: data.sessionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Error deleting current session:", error);
    return NextResponse.json(
      {
        error: "Error deleting current session",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
