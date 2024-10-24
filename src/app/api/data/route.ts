import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Path to our data file
const dataFile = path.join(process.cwd(), "data", "rc-timer-data.json");

// Ensure data directory exists
async function ensureDataDirectory() {
  const dataDir = path.join(process.cwd(), "data");
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir);
  }
}

// GET handler to read data
export async function GET() {
  try {
    await ensureDataDirectory();

    try {
      const data = await fs.readFile(dataFile, "utf8");
      return NextResponse.json(JSON.parse(data));
    } catch (error: any) {
      if (error.code === "ENOENT") {
        // If file doesn't exist, create it with empty data
        const initialData = {
          sessions: [],
          drivers: [],
          lastUpdated: new Date().toISOString(),
        };
        await fs.writeFile(dataFile, JSON.stringify(initialData, null, 2));
        return NextResponse.json(initialData);
      }
      throw error;
    }
  } catch (error) {
    console.error("Error reading data:", error);
    return NextResponse.json({ error: "Error reading data" }, { status: 500 });
  }
}

// POST handler to save data
export async function POST(request: Request) {
  try {
    await ensureDataDirectory();

    const data = await request.json();
    await fs.writeFile(dataFile, JSON.stringify(data, null, 2));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving data:", error);
    return NextResponse.json({ error: "Error saving data" }, { status: 500 });
  }
}
