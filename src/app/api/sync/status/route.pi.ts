import { NextResponse } from "next/server";
import { BUNDLE_SCHEMA_VERSION } from "@/domain/sync/bundle";
import { logger } from "@/lib/logger";
import { timerId } from "@/lib/sync";

export const dynamic = "force-dynamic";

// Tells the phone app it has found a timer, and which backup format it speaks.
export async function GET() {
  try {
    return NextResponse.json({ app: "rc-lap-timer", schemaVersion: BUNDLE_SCHEMA_VERSION, deviceId: await timerId() });
  } catch (error) {
    logger.error("Error reading sync status:", error);
    return NextResponse.json({ error: "Couldn't read the timer's data" }, { status: 500 });
  }
}
