// The root-owned helper that changes the Pi's system settings and clock: scripts/system/rc-config-helper.sh, installed
// as /usr/local/bin/rc-config-helper.sh and allowed by the sudoers rule in docs/raspberryPiSetup.md. Input never
// reaches a shell: the helper runs via execFile with an argument array, and secrets go over stdin.
import { execFile } from "child_process";
import { access } from "fs/promises";
import { constants } from "fs";

export const HELPER = "/usr/local/bin/rc-config-helper.sh";

export async function helperInstalled(): Promise<boolean> {
  try {
    await access(HELPER, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

// Resolves with what the helper printed.
export function runHelper(args: string[], stdin?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile("sudo", ["-n", HELPER, ...args], { timeout: 30_000 }, (err, stdout, stderr) => {
      if (err) {
        // The original helper printed its errors to stdout, so include both streams.
        reject(new Error([stderr.trim(), stdout.trim()].filter(Boolean).join("\n") || err.message));
      } else {
        resolve(stdout.trim());
      }
    });
    child.stdin?.end(stdin === undefined ? "" : `${stdin}\n`);
  });
}

// An installed helper older than the app doesn't know the command it was given.
export function helperOutdated(error: unknown): boolean {
  const detail = error instanceof Error ? error.message : String(error);
  return detail.includes("unknown command") || detail.includes("Invalid command");
}
