import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; 

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const driver = searchParams.get("driver");
    const car = searchParams.get("car");
    const location = searchParams.get("location");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    const races = await prisma.race.findMany({
      where: {
        status: "FINISHED",
        ...(location !== "all" && { locationId: location }),
        ...(fromDate && { date: { gte: new Date(fromDate) } }),
        ...(toDate && { date: { lte: new Date(toDate) } }),
        entries: {
          some: {
            ...(driver !== "all" && { driverId: driver }),
            ...(car !== "all" && { carId: car }),
          },
        },
      },
      include: {
        entries: {
          include: {
            driver: true,
            car: true,
          },
        },
      },
    });

    const formattedRaces = races.flatMap(race => 
      race.entries.map(entry => ({
        id: race.id,
        date: race.date,
        location: race.name.split('-').slice(2).join('-'),
        driver: entry.driver.name,
        car: entry.car.name,
        position: entry.position,
        bestLap: entry.bestLapTime,
        laps: entry.lapsCompleted,
        status: entry.status,
      }))
    );

    return NextResponse.json(formattedRaces);
  } catch (error) {
    console.error("Error fetching race results:", error);
    return NextResponse.json({ error: "Failed to fetch race results" }, { status: 500 });
  }
}