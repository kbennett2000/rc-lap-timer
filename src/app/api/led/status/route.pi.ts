// app/api/led/status/route.ts
import { NextResponse } from "next/server";
import { LED_DEVICE_IP, LED_DEVICE_TIMEOUT } from "../config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Asked every time: Next 14 would otherwise keep the first answer, and say "connected" from then on.
    const response = await fetch(`http://${LED_DEVICE_IP}/`, {
      cache: "no-store",
      signal: AbortSignal.timeout(LED_DEVICE_TIMEOUT),
    });
    if (response.ok) {
      return NextResponse.json({ status: "connected" });
    }
    throw new Error(`Device responded with status: ${response.status}`);
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json({
      status: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
