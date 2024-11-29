// src/app/api/session-requests/next/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { convertBigIntToNumber } from "@/lib/utils";
import { SessionRequestStatus } from "@prisma/client";

// Export config to make this a dynamic route
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Support both GET and HEAD methods
export async function GET(request: Request) {
  try {
    // Check raw record count first
    const recordCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM SessionRequest`;

    // Raw SQL check with BINARY comparison
    const rawPendingRecords = await prisma.$queryRaw`
      SELECT * FROM SessionRequest 
      WHERE BINARY status = 'PENDING'
      ORDER BY createdAt ASC
    `;

    // Prisma check with explicit enum
    const prismaRecords = await prisma.SessionRequest.findMany({
      where: {
        status: SessionRequestStatus.PENDING,
      },
      include: {
        driver: true,
        car: true,
        location: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return NextResponse.json({
      request: prismaRecords[0] || null,
      debug: {
        recordCount: convertBigIntToNumber(recordCount),
        rawPendingCount: rawPendingRecords.length,
        prismaCount: prismaRecords.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("Error in poll request:", error);
    return NextResponse.json(
      {
        error: "Poll request failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// Support OPTIONS method for CORS
export async function OPTIONS(request: Request) {
  return NextResponse.json(
    {},
    {
      headers: {
        Allow: "GET, HEAD, OPTIONS",
      },
    }
  );
}
