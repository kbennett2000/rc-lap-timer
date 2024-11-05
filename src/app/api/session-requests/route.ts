// src/app/api/session-requests/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const { driverId, carId, locationId, numberOfLaps } = await request.json();

    const newRequest = await prisma.sessionRequest.create({
      data: {
        driverId,
        carId,
        locationId,
        numberOfLaps,
        status: "PENDING",
      },
      include: {
        driver: true,
        car: true,
        location: true,
      },
    });

    return NextResponse.json(newRequest);
  } catch (error) {
    logger.error("Error creating session request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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