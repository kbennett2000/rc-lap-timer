// src/app/api/session-requests/[id]/status/route.ts
import { NextResponse } from "next/server";
import { Prisma, SessionRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const VALID_STATUSES = new Set<string>(Object.values(SessionRequestStatus));

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { status } = await request.json();

    if (typeof status !== "string" || !VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: `status must be one of ${[...VALID_STATUSES].join(", ")}` }, { status: 400 });
    }

    const updatedRequest = await prisma.sessionRequest.update({
      where: { id: params.id },
      data: { status: status as SessionRequestStatus },
    });

    return NextResponse.json({ success: true, request: updatedRequest });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Session request not found" }, { status: 404 });
    }
    logger.error("Error updating status:", error);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}
