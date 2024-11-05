// src/app/api/session-requests/[id]/status/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { status } = await request.json();
    const { id } = params;

    const updatedRequest = await prisma.sessionRequest.update({
      where: { id: String(id) },
      data: { status }
    });

    return NextResponse.json(updatedRequest);
  } catch (error) {
    logger.error("Error updating request status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}