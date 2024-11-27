// src/app/api/ir/current_car/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // Here you would implement the actual IR detection logic
    // For now, we'll return a mock response to test the integration
    return NextResponse.json({
      id: null, // car number
      time: null, // detection timestamp
    });
  } catch (error) {
    console.error("Error reading IR data:", error);
    return NextResponse.json({ error: "Failed to read IR data" }, { status: 500 });
  }
}
