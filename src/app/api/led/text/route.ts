// app/api/led/text/route.ts
import { NextResponse } from "next/server";
import { LED_DEVICE_IP, LED_DEVICE_TIMEOUT } from '../config';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title");
  const message = searchParams.get("message");

  try {
    const response = await fetch(`http://${LED_DEVICE_IP}/text?title=${encodeURIComponent(title || "")}&message=${encodeURIComponent(message || "")}`);
    if (!response.ok) throw new Error("Failed to set LED message");
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to communicate with LED device" }, { status: 500 });
  }
}
