import { NextResponse } from "next/server";
import { checkMotionSettings, duplicateNameMessage } from "@/domain/rules";
import { badRequest, conflict, createOnce, isPrismaError, notFound, parseClientId, readJson } from "@/lib/api-helpers";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Saved motion detector settings. Names are unique; see checkMotionSettings for the allowed ranges.

export async function GET() {
  try {
    const settings = await prisma.motionSettings.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json(settings);
  } catch (error) {
    logger.error("Error fetching motion settings:", error);
    return NextResponse.json({ error: "Failed to fetch motion settings" }, { status: 500 });
  }
}

// Creates a setting. A client may send its own id; repeating the create with it returns the existing setting.
export async function POST(request: Request) {
  try {
    const data = await readJson(request);
    const checked = checkMotionSettings(data);
    if (!checked.ok) return badRequest("Invalid input data", checked.errors);
    const id = parseClientId(data?.id);
    if (!id.ok) return badRequest(id.error);
    const input = checked.value;

    const result = await createOnce("motionSetting", input.name, {
      findById: async () => (id.value ? prisma.motionSettings.findUnique({ where: { id: id.value } }) : null),
      nameTaken: async () => Boolean(await prisma.motionSettings.findFirst({ where: { name: input.name } })),
      create: () => prisma.motionSettings.create({ data: { id: id.value, ...input } }),
    });
    if (result instanceof NextResponse) return result;
    return NextResponse.json(result.record);
  } catch (error) {
    logger.error("Error creating motion settings:", error);
    return NextResponse.json({ error: "Failed to create motion settings" }, { status: 500 });
  }
}

// Replaces every field of a setting.
export async function PUT(request: Request) {
  try {
    const data = await readJson(request);
    const id = data?.id;
    if (typeof id !== "string" || !id) return badRequest("Motion settings ID is required");
    const checked = checkMotionSettings(data);
    if (!checked.ok) return badRequest("Invalid input data", checked.errors);
    const input = checked.value;

    if (await prisma.motionSettings.findFirst({ where: { name: input.name, id: { not: id } } })) {
      return conflict(duplicateNameMessage("motionSetting", input.name));
    }
    const settings = await prisma.motionSettings.update({ where: { id }, data: input });
    return NextResponse.json(settings);
  } catch (error) {
    if (isPrismaError(error, "P2025")) return notFound("Motion settings not found");
    if (isPrismaError(error, "P2002")) return conflict("That name is already in use");
    logger.error("Error updating motion settings:", error);
    return NextResponse.json({ error: "Failed to update motion settings" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return badRequest("Motion settings ID is required");

    await prisma.motionSettings.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isPrismaError(error, "P2025")) return notFound("Motion settings not found");
    logger.error("Error deleting motion settings:", error);
    return NextResponse.json({ error: "Failed to delete motion settings" }, { status: 500 });
  }
}
