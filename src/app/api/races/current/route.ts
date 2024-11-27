// src/app/api/races/current/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const activeRace = await prisma.race.findFirst({
      where: {
        status: {
          in: ["COUNTDOWN", "RACING", "PAUSED"],
        },
      },
      include: {
        location: true,
        entries: {
          include: {
            driver: true,
            car: true,
            laps: {
              orderBy: {
                timestamp: "desc",
              },
              take: 1,
            },
          },
        },
      },
      orderBy: {
        startTime: "desc",
      },
    });

    if (!activeRace) {
      return NextResponse.json(null);
    }

    return NextResponse.json(activeRace);
  } catch (error) {
    console.error("Failed to fetch current race:", error);
    return NextResponse.json({ error: "Failed to fetch current race" }, { status: 500 });
  }
}
