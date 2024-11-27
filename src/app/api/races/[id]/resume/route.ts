// src/app/api/races/[id]/resume/route.ts
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

    if (race.status !== "PAUSED") {
      return NextResponse.json({ error: "Race must be in PAUSED state to resume" }, { status: 400 });
    }

    const updatedRace = await prisma.race.update({
      where: { id: params.id },
      data: {
        status: "RACING",
      },
    });

    return NextResponse.json(updatedRace);
  } catch (error) {
    console.error("Failed to resume race:", error);
    return NextResponse.json({ error: "Failed to resume race" }, { status: 500 });
  }
}
