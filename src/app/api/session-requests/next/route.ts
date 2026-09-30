// src/app/api/session-requests/next/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { SessionRequestStatus } from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Returns the oldest pending session request, or null.
export async function GET() {
  try {
    const nextRequest = await prisma.sessionRequest.findFirst({
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

    return NextResponse.json({ request: nextRequest });
  } catch (error) {
    logger.error("Error in poll request:", error);
    return NextResponse.json({ error: "Poll request failed" }, { status: 500 });
  }
}
