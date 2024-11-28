// src/app/api/races/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UpdateRaceRequest } from "../types";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const race = await prisma.race.findUnique({
      where: { id: params.id },
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

    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    return NextResponse.json(race);
  } catch (error) {
    console.error("Failed to fetch race:", error);
    return NextResponse.json({ error: "Failed to fetch race" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const updates: UpdateRaceRequest = await request.json();

    const race = await prisma.race.update({
      where: { id: params.id },
      data: {
        status: updates.status,
        ...(updates.status === "RACING" && {
          startTime: new Date(),
        }),
        ...(updates.status === "FINISHED" && {
          endTime: new Date(),
        }),
      },
    });

    return NextResponse.json(race);
  } catch (error) {
    console.error("Failed to update race:", error);
    return NextResponse.json({ error: "Failed to update race" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const race = await prisma.race.findUnique({
      where: { id: params.id },
    });

    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    // Delete all related records in a transaction
    await prisma.$transaction([
      prisma.raceLap.deleteMany({
        where: {
          raceEntry: {
            raceId: params.id,
          },
        },
      }),
      prisma.raceEntry.deleteMany({
        where: {
          raceId: params.id,
        },
      }),
      prisma.race.delete({
        where: {
          id: params.id,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      deletedRaceId: params.id,
    });
  } catch (error) {
    console.error("Failed to delete race:", error);
    return NextResponse.json({ error: "Failed to delete race" }, { status: 500 });
  }
}
