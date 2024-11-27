// src/app/api/races/[id]/pause/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const race = await prisma.race.findUnique({
      where: { id: params.id },
    });

    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    if (race.status !== "RACING") {
      return NextResponse.json({ error: "Race must be in RACING state to pause" }, { status: 400 });
    }

    const updatedRace = await prisma.race.update({
      where: { id: params.id },
      data: {
        status: "PAUSED",
      },
    });

    return NextResponse.json(updatedRace);
  } catch (error) {
    console.error("Failed to pause race:", error);
    return NextResponse.json({ error: "Failed to pause race" }, { status: 500 });
  }
}
