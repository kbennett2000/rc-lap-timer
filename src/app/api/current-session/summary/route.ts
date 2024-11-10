// app/api/current-session/summary/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic"; // Disable route caching
export const revalidate = 0; // Disable fetch caching

export async function GET() {
  // const execId = Date.now(); // Use timestamp to ensure unique execution ID
  // logger.log(`[${execId}] Route execution started`);

  try {
    // First verify we can read ANY data from the database
    // logger.log(`[${execId}] Testing basic database read`);
    // const dbTest = await prisma.$queryRaw`SELECT COUNT(*) as count FROM CurrentSession`;
    // logger.log(`[${execId}] Database test result:`, dbTest);

    // logger.log(`[${execId}] Fetching sessions`);
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

    // logger.log(`[${execId}] Query complete. Found ${sessions.length} sessions`);

    /*
    if (sessions.length > 0) {
      logger.log(`[${execId}] First session:`, {
        id: sessions[0].id,
        driverName: sessions[0].driverName,
        createdAt: sessions[0].createdAt,
      });
    }
    */
   
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
