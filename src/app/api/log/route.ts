import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(request: Request) {
  try {
    const logData = {
      timestamp: new Date().toISOString(),
      ...(await request.json())
    };

    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir);
    }

    // Append to log file
    const logFile = path.join(logsDir, "motion.log");
    fs.appendFileSync(logFile, JSON.stringify(logData) + "\n");

    // Also console.log on server
    console.log("Motion Log:", logData);

    return NextResponse.json({ message: "Logged successfully" });
  } catch (error) {
    console.error("Logging error:", error);
    return NextResponse.json(
      { message: "Error logging data" }, 
      { status: 500 }
    );
  }
}