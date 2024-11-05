import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
// import fs from "fs";
// import path from "path";

export async function POST(request: Request) {
  try {
    const logData = {
      timestamp: new Date().toISOString(),
      ...(await request.json())
    };

    // TODO: uncomment to restore file system logging
    /*
    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir);
    }

    // Append to log file
    const logFile = path.join(logsDir, "motion.log");
    fs.appendFileSync(logFile, JSON.stringify(logData) + "\n");
    */

    // Also logger.log on server
    logger.log("Motion Log:", logData);

    return NextResponse.json({ message: "Logged successfully" });
  } catch (error) {
    logger.error("Logging error:", error);
    return NextResponse.json(
      { message: "Error logging data" }, 
      { status: 500 }
    );
  }
}