// src/app/api/session-requests/[id]/status/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { status } = await request.json();
    const { id } = params;

    logger.log("Status update request:", { id, status });

    // Check current status
    const currentState = await prisma.sessionRequest.findUnique({
      where: { id },
    });
    logger.log("Current state:", currentState);

    // Update using raw SQL first to verify enum
    const rawUpdate = await prisma.$executeRaw`
      UPDATE SessionRequest 
      SET status = ${status}, 
          updatedAt = NOW() 
      WHERE id = ${id}
    `;
    logger.log("Raw SQL update result:", rawUpdate);

    // Verify the update with Prisma
    const updatedRequest = await prisma.sessionRequest.findUnique({
      where: { id },
    });
    logger.log("Updated state:", updatedRequest);

    // Check all requests after update
    const allRequests = await prisma.sessionRequest.findMany({
      orderBy: { createdAt: "desc" },
    });
    logger.log("All requests after update:", allRequests);

    return NextResponse.json({
      success: true,
      state: {
        before: currentState,
        after: updatedRequest,
      },
      allRequests,
    });
  } catch (error) {
    logger.error("Error updating status:", error);
    return NextResponse.json({ error: "Failed to update status", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
