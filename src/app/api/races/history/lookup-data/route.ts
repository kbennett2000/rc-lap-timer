// /api/races/history/lookup-data/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// TODO: delete
console.log('Module loaded');

export const dynamic = 'force-dynamic';
export async function GET() {
  // TODO: delete
  // console.log('Endpoint hit');

  try {
    const rawDrivers = await prisma.$queryRaw`SELECT * FROM Driver`;

    // TODO: delete
    // console.log('Raw Driver query:', rawDrivers);
    
    const drivers = await prisma.driver.findMany();
    const cars = await prisma.car.findMany();
    const locations = await prisma.location.findMany();

    // TODO: delete
    // console.log('Query results:', { drivers, cars, locations });

    return NextResponse.json({ locations, drivers, cars });
  } catch (error) {
    console.error('Lookup data error:', error);
    throw error;
  }
}