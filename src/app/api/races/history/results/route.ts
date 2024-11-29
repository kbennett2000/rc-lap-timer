// /api/races/history/results/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const driver = searchParams.get("driver");
    const car = searchParams.get("car");
    const location = searchParams.get("location");

    // TODO: delete?
    // const races = await prisma.race.findMany({
    //  where: {
    //    status: "FINISHED",
    //    entries: {
    //      some: {
    //        ...(driver !== "all" && { driverId: driver }),
    //        ...(car !== "all" && { carId: car }),
    //      },
    //    },
    //    ...(location !== "all" && { locationId: location }),
    //  },
    //  include: {
    //    entries: {
    //      include: { driver: true, car: true },
    //    },
    //  },
    //  orderBy: { date: "desc" },
    // });

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

    console.log(
      "Race entries:",
      races.flatMap((race) => race.entries)
    );

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
        }))
      )
    );
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json([]);
  }
}
