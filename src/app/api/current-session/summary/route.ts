import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    // Get current sessions with their laps, ordered by most recent first
    const sessions = await prisma.currentSession.findMany({
      include: {
        laps: {
          orderBy: {
            createdAt: "asc", // Order laps by creation time
          },
        },
      },
      orderBy: {
        createdAt: "desc", // Most recent session first
      },
      take: 1, // Only get the most recent session
    });

    // If no sessions found, return an empty array
    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        success: true,
        sessions: [],
      });
    }

    // Transform the data to match the expected format
    const formattedSessions = sessions.map((session) => ({
      id: session.id,
      driverName: session.driverName,
      carName: session.carName,
      locationName: session.locationName,
      lapCount: session.lapCount,
      createdAt: session.createdAt.toISOString(),
      laps: session.laps.map((lap) => ({
        id: lap.id,
        lapTime: lap.lapTime,
        penaltyCount: lap.penaltyCount,
        createdAt: lap.createdAt.toISOString(),
      })),
    }));

    return NextResponse.json({
      success: true,
      sessions: formattedSessions,
    });
  } catch (error) {
    logger.error("Error fetching current session summary:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch current session summary",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: 500,
      }
    );
  }
}

// Add a health check endpoint
export async function HEAD() {
  try {
    // Just check if we can connect to the database
    await prisma.$queryRaw`SELECT 1`;
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    logger.error("Health check failed:", error);
    return new NextResponse(null, { status: 500 });
  }
}
