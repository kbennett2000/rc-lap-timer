// app/api/current-session/summary/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic"; // Disable route caching
export const revalidate = 0; // Disable fetch caching

export async function GET() {
  try {
    const sessions = await prisma.currentSession.findMany({
      include: {
        laps: {
          orderBy: {
            lapNumber: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 1,
    });

    return NextResponse.json({
      success: true,
      sessions: sessions.map((session) => ({
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
      })),
      // execId, // Include execution ID in response
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // logger.error(`[${execId}] Error in route handler:`, error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch current session summary",
        details: error instanceof Error ? error.message : "Unknown error",
        // execId,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
