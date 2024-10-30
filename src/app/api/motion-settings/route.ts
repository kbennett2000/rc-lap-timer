// app/api/motion-settings/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const settings = await prisma.motionSettings.findMany({
      orderBy: { name: 'asc' }
    });
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: "Error fetching settings" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const settings = await prisma.motionSettings.create({
      data: {
        name: data.name,
        sensitivity: data.sensitivity,
        threshold: data.threshold,
        cooldown: data.cooldown
      }
    });
    return NextResponse.json(settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error saving settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}