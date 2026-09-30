import { NextResponse } from "next/server";
import { badRequest, isJsonRequest, notJson, readJson } from "@/lib/api-helpers";
import { syncClock } from "@/lib/clock";
import { forbiddenOrigin, preflight, refusedOrigin, withCors } from "@/lib/cors";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// A phone or browser tells the timer the time, which sets the timer's clock if it's behind (see src/lib/clock.ts).
// It's under /api/sync so the phone app reaches it the same way as the other sync routes.

const EARLIEST = Date.UTC(2020, 0, 1);
const LATEST = Date.UTC(2100, 0, 1);

export function OPTIONS(request: Request) {
  return preflight(request);
}

// { now }: the device's time in milliseconds since 1970 -> { changed, reason }.
export async function POST(request: Request) {
  return withCors(request, await setClock(request));
}

async function setClock(request: Request): Promise<Response> {
  if (refusedOrigin(request)) return forbiddenOrigin();
  if (!isJsonRequest(request)) return notJson();
  const now = (await readJson(request))?.now;
  if (typeof now !== "number" || !(now >= EARLIEST && now < LATEST)) {
    return badRequest("now must be the time in milliseconds since 1970");
  }
  try {
    return NextResponse.json(await syncClock(now));
  } catch (error) {
    logger.error("Error setting the timer's clock:", error);
    return NextResponse.json({ error: "Couldn't set the timer's clock" }, { status: 500 });
  }
}
