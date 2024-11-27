// src/app/api/races/[id]/laps/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RecordLapRequest } from "../../types";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { carNumber, timestamp }: RecordLapRequest = await request.json();

    const race = await prisma.race.findUnique({
      where: { id: params.id },
      include: {
        entries: {
          include: {
            laps: true,
          },
        },
      },
    });

    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    const entry = race.entries.find((e) => e.carNumber === carNumber);
    if (!entry) {
      return NextResponse.json({ error: "Car not found in race" }, { status: 404 });
    }

    // Calculate lap time and position
    const lastLap = entry.laps.length > 0 ? entry.laps.reduce((latest, lap) => (lap.timestamp > latest.timestamp ? lap : latest)) : null;

    const lapTime = lastLap ? timestamp - lastLap.timestamp.getTime() : timestamp - race.startTime!.getTime();

    // Calculate positions
    const allEntries = race.entries.map((e) => ({
      ...e,
      lastLapCompleted: e.laps.length > 0 ? e.laps.reduce((latest, lap) => (lap.timestamp > latest.timestamp ? lap : latest)).timestamp : race.startTime,
    }));

    const positions = allEntries
      .sort((a, b) => {
        if (a.laps.length !== b.laps.length) {
          return b.laps.length - a.laps.length;
        }
        return a.lastLapCompleted!.getTime() - b.lastLapCompleted!.getTime();
      })
      .map((e, index) => ({ carNumber: e.carNumber, position: index + 1 }));

    const currentPosition = positions.find((p) => p.carNumber === carNumber)?.position || entry.laps.length + 1;

    // Calculate gap to leader
    const leader = allEntries[0];
    const gap = leader.carNumber === carNumber ? 0 : timestamp - leader.lastLapCompleted!.getTime();

    // Create new lap record
    const [lap] = await prisma.$transaction([
      prisma.raceLap.create({
        data: {
          raceEntryId: entry.id,
          lapNumber: entry.laps.length + 1,
          lapTime,
          position: currentPosition,
          gap,
          timestamp: new Date(timestamp),
        },
      }),
      prisma.raceEntry.update({
        where: { id: entry.id },
        data: {
          lapsCompleted: entry.laps.length + 1,
          bestLapTime: !entry.bestLapTime || lapTime < entry.bestLapTime ? lapTime : undefined,
          position: currentPosition,
          status: race.totalLaps && entry.laps.length + 1 >= race.totalLaps ? "FINISHED" : "RACING",
        },
      }),
    ]);

    return NextResponse.json(lap);
  } catch (error) {
    console.error("Failed to record lap:", error);
    return NextResponse.json({ error: "Failed to record lap" }, { status: 500 });
  }
}
