// /api/races/history/lookup-data/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
      // Add detailed logging
      console.log('Database config:', process.env.DATABASE_URL);
      
      const drivers = await prisma.driver.findMany();
      console.log('Drivers from DB:', drivers);
      
      const cars = await prisma.car.findMany();
      console.log('Cars from DB:', cars);
      
      const locations = await prisma.location.findMany();
      console.log('Locations from DB:', locations);
  
      return NextResponse.json({ locations, drivers, cars });
    } catch (error) {
      console.error("Error fetching lookup data:", error);
      return NextResponse.json({ error: "Failed to fetch lookup data" }, { status: 500 });
    }
  }