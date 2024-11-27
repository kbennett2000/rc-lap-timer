// src/app/api/races/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateRaceRequest } from "./types";

export async function POST(request: NextRequest) {
  try {
    const config: CreateRaceRequest = await request.json();

    const race = await prisma.race.create({
      data: {
        name: config.name,
        date: new Date(),
        locationId: config.locationId,
        startDelay: config.startDelay,
        totalLaps: config.totalLaps,
        status: "PENDING",
        entries: {
          create: config.entries.map((entry) => ({
            driverId: entry.driverId,
            carId: entry.carId,
            carNumber: entry.carNumber,
            status: "REGISTERED",
            lapsCompleted: 0,
          })),
        },
      },
      include: {
        location: true,
        entries: {
          include: {
            driver: true,
            car: true,
            laps: true,
          },
        },
      },
    });

    return NextResponse.json(race);
  } catch (error) {
    console.error("Failed to create race:", error);
    return NextResponse.json({ error: "Failed to create race" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const races = await prisma.race.findMany({
      include: {
        location: true,
        entries: {
          include: {
            driver: true,
            car: true,
            laps: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    return NextResponse.json(races);
  } catch (error) {
    console.error("Failed to fetch races:", error);
    return NextResponse.json({ error: "Failed to fetch races" }, { status: 500 });
  }
}
