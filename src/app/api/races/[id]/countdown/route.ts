// src/app/api/races/[id]/countdown/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CountdownStartRequest } from "../../../types";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { duration } = (await request.json()) as CountdownStartRequest;

    const race = await prisma.race.findUnique({
      where: { id: params.id },
    });

    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    if (race.status !== "PENDING") {
      return NextResponse.json({ error: "Race must be in PENDING state to start countdown" }, { status: 400 });
    }

    const updatedRace = await prisma.race.update({
      where: { id: params.id },
      data: {
        status: "COUNTDOWN",
        startDelay: duration || race.startDelay,
        // We'll calculate the actual start time after countdown in the race component
      },
    });

    return NextResponse.json(updatedRace);
  } catch (error) {
    console.error("Failed to start countdown:", error);
    return NextResponse.json({ error: "Failed to start countdown" }, { status: 500 });
  }
}
