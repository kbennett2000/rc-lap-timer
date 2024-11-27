// src/app/api/races/[id]/state/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const race = await prisma.race.findUnique({
      where: { id: params.id },
      include: {
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
    });

    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    // Calculate current race state
    const raceState = {
      raceId: race.id,
      status: race.status,
      entries: race.entries.map((entry) => {
        const lastLap = entry.laps[0];
        const bestLap = entry.bestLapTime;

        return {
          carNumber: entry.carNumber,
          driverName: entry.driver.name,
          carName: entry.car.name,
          position: entry.position || 0,
          lapsCompleted: entry.lapsCompleted,
          lastLapTime: lastLap?.lapTime,
          bestLapTime: bestLap,
          gapToLeader: lastLap?.gap,
          status: entry.status,
        };
      }),
    };

    return NextResponse.json(raceState);
  } catch (error) {
    console.error("Failed to fetch race state:", error);
    return NextResponse.json({ error: "Failed to fetch race state" }, { status: 500 });
  }
}

