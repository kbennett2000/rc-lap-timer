// app/api/motion-settings/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Validation helper functions
function validateMotionSettings(data: any) {
  const errors: string[] = [];

  if (!data.name || typeof data.name !== "string" || data.name.trim().length === 0) {
    errors.push("Name is required");
  }

  if (!Number.isInteger(data.sensitivity) || data.sensitivity < 5 || data.sensitivity > 200) {
    errors.push("Sensitivity must be an integer between 5 and 200");
  }

  if (typeof data.threshold !== "number" || data.threshold < 0.1 || data.threshold > 10.0) {
    errors.push("Threshold must be a number between 0.1 and 10.0");
  }

  if (!Number.isInteger(data.cooldown) || data.cooldown < 100 || data.cooldown > 10000) {
    errors.push("Cooldown must be an integer between 100 and 10000");
  }

  if (!Number.isInteger(data.framesToSkip) || data.framesToSkip < 1 || data.framesToSkip > 30) {
    errors.push("Frames to skip must be an integer between 1 and 30");
  }

  return errors;
}

// GET - Fetch all motion settings
export async function GET() {
  try {
    const settings = await prisma.motionSettings.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error fetching motion settings:", error);
    return NextResponse.json({ error: "Failed to fetch motion settings" }, { status: 500 });
  }
}

// POST - Create new motion settings
export async function POST(request: Request) {
  try {
    const data = await request.json();

    // Validate input data
    const validationErrors = validateMotionSettings(data);
    if (validationErrors.length > 0) {
      return NextResponse.json({ error: "Invalid input data", details: validationErrors }, { status: 400 });
    }

    // Check if name already exists
    const existing = await prisma.motionSettings.findFirst({
      where: {
        name: data.name,
      },
    });

    if (existing) {
      return NextResponse.json({ error: "A motion setting with this name already exists" }, { status: 400 });
    }

    // Create new motion settings
    const settings = await prisma.motionSettings.create({
      data: {
        name: data.name,
        sensitivity: data.sensitivity,
        threshold: data.threshold,
        cooldown: data.cooldown,
        framesToSkip: data.framesToSkip,
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error creating motion settings:", error);
    return NextResponse.json({ error: "Failed to create motion settings" }, { status: 500 });
  }
}

// PUT - Update motion settings
export async function PUT(request: Request) {
  try {
    const data = await request.json();
    const { id, ...updateData } = data;

    if (!id) {
      return NextResponse.json({ error: "Motion settings ID is required" }, { status: 400 });
    }

    // Validate input data
    const validationErrors = validateMotionSettings(updateData);
    if (validationErrors.length > 0) {
      return NextResponse.json({ error: "Invalid input data", details: validationErrors }, { status: 400 });
    }

    // Check if name already exists (excluding current record)
    const existing = await prisma.motionSettings.findFirst({
      where: {
        name: updateData.name,
        id: { not: id },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "A motion setting with this name already exists" }, { status: 400 });
    }

    // Update motion settings
    const settings = await prisma.motionSettings.update({
      where: { id },
      data: {
        name: updateData.name,
        sensitivity: updateData.sensitivity,
        threshold: updateData.threshold,
        cooldown: updateData.cooldown,
        framesToSkip: updateData.framesToSkip,
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error updating motion settings:", error);
    return NextResponse.json({ error: "Failed to update motion settings" }, { status: 500 });
  }
}

// DELETE - Delete motion settings by ID
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Motion settings ID is required" }, { status: 400 });
    }

    await prisma.motionSettings.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting motion settings:", error);
    return NextResponse.json({ error: "Failed to delete motion settings" }, { status: 500 });
  }
}
