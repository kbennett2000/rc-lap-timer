// src/app/api/session-requests/route.ts
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { SessionRequestStatus } from "@prisma/client";

export async function POST(request: Request) {
  try {
    const { driverId, carId, locationId, numberOfLaps } = await request.json();

    // Log the state before creation
    const beforeState = await prisma.SessionRequest.findMany({
      select: {
        id: true,
        status: true,
      },
    });
    logger.log("State before creation:", beforeState);

    // Create the request with explicit PENDING status
    const newRequest = await prisma.SessionRequest.create({
      data: {
        driverId,
        carId,
        locationId,
        numberOfLaps,
        status: SessionRequestStatus.PENDING,
      },
    });
    logger.log("Created request:", newRequest);

    // Immediately verify the creation
    const afterState = await prisma.SessionRequest.findMany({
      select: {
        id: true,
        status: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    logger.log("State after creation:", afterState);

    // Double-check with raw SQL
    const sqlCheck = await prisma.$queryRaw`
      SELECT id, status, HEX(status) as status_hex 
      FROM SessionRequest 
      WHERE id = ${newRequest.id}
    `;
    logger.log("SQL verification:", sqlCheck);

    return NextResponse.json({
      request: newRequest,
      debug: {
        beforeState,
        afterState,
        sqlCheck,
      },
    });
  } catch (error) {
    logger.error("Error creating session request:", error);
    return NextResponse.json({ error: "Failed to create session request", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const requests = await prisma.sessionRequest.findMany({
      include: {
        driver: true,
        car: true,
        location: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    logger.error("Error fetching session requests:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
