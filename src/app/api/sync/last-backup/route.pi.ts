import { NextResponse } from "next/server";
import { badRequest, isJsonRequest, notJson, readJson } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { lastBackupAt, markBackedUp } from "@/lib/sync";

export const dynamic = "force-dynamic";

// When a backup of the timer's data was last saved: { lastBackupAt } (null if never).

export async function GET() {
  try {
    return NextResponse.json({ lastBackupAt: await lastBackupAt() });
  } catch (error) {
    logger.error("Error reading the last backup:", error);
    return NextResponse.json({ error: "Couldn't read the timer's data" }, { status: 500 });
  }
}

// { at }: an ISO date.
export async function PUT(request: Request) {
  if (!isJsonRequest(request)) return notJson();
  const data = await readJson(request);
  const at = typeof data?.at === "string" ? new Date(data.at) : null;
  if (!at || Number.isNaN(at.getTime())) return badRequest("at must be a date");
  try {
    await markBackedUp(at.toISOString());
    return NextResponse.json({ lastBackupAt: at.toISOString() });
  } catch (error) {
    logger.error("Error saving the last backup:", error);
    return NextResponse.json({ error: "Couldn't save on the timer" }, { status: 500 });
  }
}
