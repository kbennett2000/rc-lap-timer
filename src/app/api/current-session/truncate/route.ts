import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    // Use a transaction to ensure both operations complete or neither does
    await prisma.$transaction([
      // Delete all current laps first (due to foreign key constraint)
      prisma.currentLap.deleteMany({}),
      // Then delete all current sessions
      prisma.currentSession.deleteMany({})
    ]);

    return NextResponse.json({ 
      success: true, 
      message: "All current sessions and laps have been deleted" 
    });
  } catch (error) {
    logger.error("Error truncating current session tables:", error);
    return NextResponse.json({ 
      error: "Failed to truncate current session tables",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { 
      status: 500 
    });
  }
}