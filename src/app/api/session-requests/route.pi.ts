// src/app/api/session-requests/route.ts
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { SessionRequestStatus } from "@prisma/client";
import { refuseWrite } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const refused = refuseWrite(request);
  if (refused) return refused;

  try {
    const { driverId, carId, locationId, numberOfLaps } = await request.json();

    if (
      typeof driverId !== "string" ||
      typeof carId !== "string" ||
      typeof locationId !== "string" ||
      !Number.isInteger(numberOfLaps) ||
      numberOfLaps <= 0
    ) {
      return NextResponse.json(
        { error: "driverId, carId, locationId and a positive numberOfLaps are required" },
        { status: 400 },
      );
    }

    const newRequest = await prisma.sessionRequest.create({
      data: {
        driverId,
        carId,
        locationId,
        numberOfLaps,
        status: SessionRequestStatus.PENDING,
      },
    });

    return NextResponse.json({ request: newRequest });
  } catch (error) {
    logger.error("Error creating session request:", error);
    return NextResponse.json({ error: "Failed to create session request" }, { status: 500 });
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
