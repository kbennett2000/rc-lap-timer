// /api/races/history/results/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Every finished race entry. The Race History screen filters these on the client.
export async function GET() {
  try {
    const races = await prisma.race.findMany({
      where: { status: "FINISHED" },
      include: {
        entries: {
          select: {
            driver: true,
            car: true,
            driverId: true,
            carId: true,
            carNumber: true,
            position: true,
            lapsCompleted: true,
            bestLapTime: true,
            status: true,
          },
        },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(
      races.flatMap((race) =>
        race.entries.map((entry) => ({
          id: race.id,
          date: race.date,
          location: race.name.split("-").slice(2).join("-"),
          driver: entry.driver.name,
          car: entry.car.name,
          position: entry.position,
          bestLap: entry.bestLapTime,
          laps: entry.lapsCompleted,
          status: entry.status,
        })),
      ),
    );
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json([]);
  }
}
