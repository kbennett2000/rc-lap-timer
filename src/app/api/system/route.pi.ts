// src/app/api/system/route.ts
//
// Pi system settings (hostname, pi user password, Wi-Fi). Changes are applied by the root-owned
// helper scripts/system/rc-config-helper.sh, installed as /usr/local/bin/rc-config-helper.sh.
//
// Security model: the endpoint is disabled unless ADMIN_PIN is set in the server environment
// (on the Pi: /etc/rc-lap-timer.env, loaded by the systemd unit so it survives upgrades), every
// request must carry that PIN, and repeated wrong PINs lock the
// endpoint, for twice as long each time (up to a day), so guessing is impractical. Restarting the app clears
// a lockout. User input never reaches a shell: the helper runs via execFile with an
// argument array, secrets go over stdin, and every value is validated here and again in the helper.
import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { access } from "fs/promises";
import { constants } from "fs";
import { createHash, timingSafeEqual } from "crypto";
import { logger } from "@/lib/logger";
import { MIN_ADMIN_PIN_LENGTH, validateSystemSettings } from "@/lib/system-settings";
import { refuseWrite } from "@/lib/api-helpers";

const HELPER = "/usr/local/bin/rc-config-helper.sh";

const MAX_FAILED_PIN_ATTEMPTS = 5;
const FIRST_LOCKOUT_MS = 5 * 60 * 1000;
const MAX_LOCKOUT_MS = 24 * 60 * 60 * 1000;
const REBOOT_DELAY_MS = 3000;

let failedPinAttempts = 0;
let lockoutsSinceLastSuccess = 0;
let pinLockedUntil = 0;

type Change = { name: string; args: string[]; stdin?: string };

function error(status: number, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

function pinMatches(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function describeWait(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  return minutes > 90 ? `${Math.ceil(minutes / 60)} hour(s)` : `${minutes} minute(s)`;
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value === "" ? undefined : value;
}

function runHelper(args: string[], stdin?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = execFile("sudo", ["-n", HELPER, ...args], { timeout: 30_000 }, (err, stdout, stderr) => {
      if (err) {
        // The original helper printed its errors to stdout, so include both streams.
        reject(new Error([stderr.trim(), stdout.trim()].filter(Boolean).join("\n") || err.message));
      } else {
        resolve();
      }
    });
    child.stdin?.end(stdin === undefined ? "" : `${stdin}\n`);
  });
}

export async function POST(request: Request) {
  const refused = refuseWrite(request);
  if (refused) return refused;

  const expectedPin = process.env.ADMIN_PIN;
  if (!expectedPin) {
    return error(
      403,
      "System settings are disabled. Set ADMIN_PIN in /etc/rc-lap-timer.env on the Pi (see docs/raspberryPiSetup.md) and restart the app.",
    );
  }
  if (expectedPin.length < MIN_ADMIN_PIN_LENGTH) {
    return error(
      403,
      `ADMIN_PIN is too short: use at least ${MIN_ADMIN_PIN_LENGTH} characters in /etc/rc-lap-timer.env, then restart the app.`,
    );
  }

  const now = Date.now();
  if (now < pinLockedUntil) {
    return error(
      429,
      `Too many wrong PIN attempts. Try again in ${describeWait(pinLockedUntil - now)}, or restart the app on the Pi.`,
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return error(400, "Request body must be JSON.");
  }

  if (typeof body.adminPin !== "string" || !pinMatches(body.adminPin, expectedPin)) {
    failedPinAttempts += 1;
    if (failedPinAttempts >= MAX_FAILED_PIN_ATTEMPTS) {
      failedPinAttempts = 0;
      lockoutsSinceLastSuccess += 1;
      pinLockedUntil = now + Math.min(FIRST_LOCKOUT_MS * 2 ** (lockoutsSinceLastSuccess - 1), MAX_LOCKOUT_MS);
    }
    return error(401, "Wrong admin PIN.");
  }
  failedPinAttempts = 0;
  lockoutsSinceLastSuccess = 0;

  const deviceName = asOptionalString(body.deviceName);
  const userPassword = asOptionalString(body.userPassword);
  const wifiName = asOptionalString(body.wifiName);
  const wifiPassword = asOptionalString(body.wifiPassword);

  const invalid = validateSystemSettings({ deviceName, userPassword, wifiName, wifiPassword });
  if (invalid) {
    return error(400, invalid);
  }

  const changes: Change[] = [];
  if (deviceName !== undefined) changes.push({ name: "device name", args: ["hostname", deviceName] });
  if (userPassword !== undefined) changes.push({ name: "password", args: ["password-stdin"], stdin: userPassword });
  if (wifiName !== undefined || wifiPassword !== undefined) {
    changes.push({ name: "Wi-Fi settings", args: ["wifi-stdin", wifiName ?? ""], stdin: wifiPassword ?? "" });
  }
  if (changes.length === 0) {
    return error(400, "Nothing to change.");
  }

  try {
    await access(HELPER, constants.X_OK);
  } catch {
    return error(
      500,
      `Configuration helper not found or not executable at ${HELPER}. Install scripts/system/rc-config-helper.sh (see docs/raspberryPiSetup.md).`,
    );
  }

  const applied: string[] = [];
  for (const change of changes) {
    try {
      logger.info(`[system] applying ${change.name}`);
      await runHelper(change.args, change.stdin);
      applied.push(change.name);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      logger.error(`[system] failed to apply ${change.name}: ${detail}`);
      const outdated = detail.includes("unknown command") || detail.includes("Invalid command");
      return error(
        500,
        outdated
          ? `The installed configuration helper is out of date. Reinstall scripts/system/rc-config-helper.sh to ${HELPER}.`
          : `Failed to update ${change.name}.`,
        { applied },
      );
    }
  }

  setTimeout(() => {
    runHelper(["reboot"]).catch((err) =>
      logger.error(`[system] reboot failed: ${err instanceof Error ? err.message : String(err)}`),
    );
  }, REBOOT_DELAY_MS);

  return NextResponse.json({ message: "Settings updated. The Pi is rebooting now.", applied, rebooting: true });
}
