// src/app/api/races/[id]/dnf/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DNFRequest } from "../../types";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { carNumber, reason }: DNFRequest = await request.json();

    const entry = await prisma.raceEntry.findFirst({
      where: {
        raceId: params.id,
        carNumber,
      },
    });

    if (!entry) {
      return NextResponse.json({ error: "Car not found in race" }, { status: 404 });
    }

    const updatedEntry = await prisma.raceEntry.update({
      where: { id: entry.id },
      data: {
        status: "DNF",
        dnfReason: reason,
      },
    });

    return NextResponse.json(updatedEntry);
  } catch (error) {
    console.error("Failed to mark DNF:", error);
    return NextResponse.json({ error: "Failed to mark DNF" }, { status: 500 });
  }
}
