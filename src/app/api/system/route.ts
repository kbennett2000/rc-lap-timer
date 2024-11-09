// src/app/api/system/route.ts
import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";

const execAsync = promisify(exec);

async function logToFile(message: string) {
  fs.appendFileSync("/home/pi/config-api.log", `${new Date().toISOString()}: ${message}\n`);
}

export async function POST(request: Request) {
  try {
    await logToFile("API POST received");

    const data = await request.json();
    await logToFile(`Request body: ${JSON.stringify(data, null, 2)}`);

    const { deviceName, userPassword, wifiName, wifiPassword, applicationUrl } = data;
    const results = [];

    // Check if helper script exists
    try {
      await execAsync("ls -l /usr/local/bin/rc-config-helper.sh");
      await logToFile("Helper script found");
    } catch (error) {
      await logToFile("Helper script not found");
      return NextResponse.json({ error: "Configuration helper script not found or not executable" }, { status: 500 });
    }

    // Update WiFi settings
    if (wifiName || wifiPassword) {
      try {
        await logToFile("Updating WiFi settings...");
        await execAsync(`sudo /usr/local/bin/rc-config-helper.sh wifi "${wifiName || ""}" "${wifiPassword || ""}"`);
        results.push("WiFi settings updated");
      } catch (error) {
        await logToFile(`WiFi update failed: ${error.message}`);
        return NextResponse.json({ error: `WiFi update failed: ${error.message}` }, { status: 500 });
      }
    }

    // Update hostname
    if (deviceName) {
      try {
        await logToFile("Updating hostname...");
        await execAsync(`sudo /usr/local/bin/rc-config-helper.sh hostname "${deviceName}"`);
        results.push("Device name updated");
      } catch (error) {
        await logToFile(`Hostname update failed: ${error.message}`);
        return NextResponse.json({ error: `Hostname update failed: ${error.message}` }, { status: 500 });
      }
    }

    // Update password
    if (userPassword) {
      try {
        await logToFile("Updating password...");
        await execAsync(`sudo /usr/local/bin/rc-config-helper.sh password "${userPassword}"`);
        results.push("Password updated");
      } catch (error) {
        await logToFile(`Password update failed: ${error.message}`);
        return NextResponse.json({ error: `Password update failed: ${error.message}` }, { status: 500 });
      }
    }

    // Send success response
    await logToFile("All updates completed successfully");

    // Schedule reboot
    setTimeout(async () => {
      try {
        await logToFile("Initiating reboot...");
        await execAsync("sudo /usr/local/bin/rc-config-helper.sh reboot");
      } catch (error) {
        await logToFile(`Reboot failed: ${error.message}`);
      }
    }, 1000);

    return NextResponse.json({
      message: "Configuration updated successfully",
      results,
    });
  } catch (error) {
    await logToFile(`API error: ${error.message}`);
    return NextResponse.json({ error: "Configuration update failed", details: error.message }, { status: 500 });
  }
}
