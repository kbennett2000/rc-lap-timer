// /api/races/history/lookup-data/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    // TODO: is rawDrivers needed?
    const rawDrivers = await prisma.$queryRaw`SELECT * FROM Driver`;

    const drivers = await prisma.driver.findMany();
    const cars = await prisma.car.findMany();
    const locations = await prisma.location.findMany();

    return NextResponse.json({ locations, drivers, cars });
  } catch (error) {
    console.error("Lookup data error:", error);
    throw error;
  }
}
