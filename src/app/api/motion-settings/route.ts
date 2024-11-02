// api/motion-settings/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { name, sensitivity, threshold, cooldown, framesToSkip } = await request.json();

    const settings = await prisma.motionSettings.create({
      data: {
        name,
        sensitivity,
        threshold,
        cooldown,
        framesToSkip,
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error creating settings:", error);
    return NextResponse.json({ error: "Failed to create settings" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const settings = await prisma.motionSettings.findMany({
      orderBy: {
        name: "asc",
      },
    });
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}
