import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { parseBundle } from "@/domain/sync/bundle";
import { badRequest, conflict, isJsonRequest, notJson, readJson } from "@/lib/api-helpers";
import { forbiddenOrigin, preflight, refusedOrigin, withCors } from "@/lib/cors";
import { logger } from "@/lib/logger";
import { exportBundle, importBundle } from "@/lib/sync";

export const dynamic = "force-dynamic";

// The timer's data as a backup file (src/domain/sync/bundle.ts), and a backup merged into it: the Data tab's Save
// and Restore, and sync with the phone app, which calls from its own site (see src/lib/cors.ts).

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function GET(request: Request) {
  try {
    return withCors(request, NextResponse.json(await exportBundle()));
  } catch (error) {
    logger.error("Error exporting data:", error);
    return withCors(request, NextResponse.json({ error: "Couldn't read the timer's data" }, { status: 500 }));
  }
}

// { bundle, dryRun? } -> { summary, dropped }: what changed (or would change), and how many records the timer left
// out because it couldn't read them.
export async function POST(request: Request) {
  return withCors(request, await merge(request));
}

async function merge(request: Request): Promise<Response> {
  if (refusedOrigin(request)) return forbiddenOrigin();
  if (!isJsonRequest(request)) return notJson();
  const data = await readJson(request);
  if (!data) return badRequest("Request body must be a JSON object");
  const parsed = parseBundle(data.bundle);
  if (!parsed.ok) return badRequest(parsed.error);

  try {
    const summary = await importBundle(parsed.bundle, { dryRun: data.dryRun === true });
    return NextResponse.json({ summary, dropped: parsed.dropped });
  } catch (error) {
    // The merge matches names the way the phone does; the database's collation can still see two names as one.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return conflict("Two names in the backup count as the same on the timer. Rename one of them and try again.");
    }
    logger.error("Error importing data:", error);
    return NextResponse.json({ error: "The timer was busy and didn't change anything. Try again." }, { status: 503 });
  }
}
