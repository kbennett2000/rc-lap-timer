// app/api/led/pattern/route.ts
import { NextResponse } from "next/server";
import { LED_DEVICE_IP, LED_DEVICE_TIMEOUT } from '../config';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");

  try {
    const response = await fetch(`http://${LED_DEVICE_IP}/pattern?name=${name}`);
    if (!response.ok) throw new Error("Failed to run LED pattern");
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to communicate with LED device" }, { status: 500 });
  }
}
