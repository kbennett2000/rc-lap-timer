// The Remote LED display (remote_led/RemoteLED.cpp): an ESP32 on the timer's Wi-Fi that takes its commands as query
// strings. The timer's pages send them to these routes as JSON posts, which another site can't, and the routes pass
// them on with every value encoded.
import { NextResponse } from "next/server";

export const LED_DEVICE_IP = process.env.LED_DEVICE_IP || "192.168.4.99";
export const LED_DEVICE_TIMEOUT = 5000; // 5 seconds

export async function sendToLed(command: string, params: Record<string, string>): Promise<Response> {
  const query = Object.entries(params)
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join("&");
  try {
    const response = await fetch(`http://${LED_DEVICE_IP}/${command}?${query}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(LED_DEVICE_TIMEOUT),
    });
    if (!response.ok) throw new Error(`LED device responded with status: ${response.status}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to communicate with LED device",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
