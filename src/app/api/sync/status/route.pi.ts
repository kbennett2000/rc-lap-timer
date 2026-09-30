import { NextResponse } from "next/server";
import { BUNDLE_SCHEMA_VERSION } from "@/domain/sync/bundle";
import { preflight, withCors } from "@/lib/cors";
import { logger } from "@/lib/logger";
import { timerId } from "@/lib/sync";

export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return preflight(request);
}

// Tells the phone app it has found a timer, and which backup format it speaks.
export async function GET(request: Request) {
  try {
    const status = { app: "rc-lap-timer", schemaVersion: BUNDLE_SCHEMA_VERSION, deviceId: await timerId() };
    return withCors(request, NextResponse.json(status));
  } catch (error) {
    logger.error("Error reading sync status:", error);
    return withCors(request, NextResponse.json({ error: "Couldn't read the timer's data" }, { status: 500 }));
  }
}
