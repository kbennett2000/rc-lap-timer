// /api/races/history/lookup-data/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const drivers = await prisma.driver.findMany();
    const cars = await prisma.car.findMany();
    const locations = await prisma.location.findMany();

    return NextResponse.json({ locations, drivers, cars });
  } catch (error) {
    console.error("Lookup data error:", error);
    throw error;
  }
}
