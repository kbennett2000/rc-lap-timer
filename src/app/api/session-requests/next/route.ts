// src/app/api/session-requests/next/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const request = await prisma.sessionRequest.findFirst({
      where: {
        status: "PENDING",
      },
      orderBy: {
        createdAt: "asc",
      },
      include: {
        driver: true,
        car: true,
        location: true,
      },
    });

    return NextResponse.json({ request });
  } catch (error) {
    logger.error("Error fetching next request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}