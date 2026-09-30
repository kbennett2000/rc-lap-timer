// Validation for the Pi System Settings, shared by the settings form and /api/system.
// scripts/system/rc-config-helper.sh checks the same rules again as root.

const HOSTNAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
const SSID_RE = /^[A-Za-z0-9-]{1,32}$/;
const PRINTABLE_ASCII_RE = /^[\x20-\x7E]+$/;

export const MIN_ADMIN_PIN_LENGTH = 6;

export type SystemSettingsInput = {
  deviceName?: string;
  userPassword?: string;
  wifiName?: string;
  wifiPassword?: string;
};

function isValidSecret(value: string, min: number, max: number): boolean {
  return value.length >= min && value.length <= max && PRINTABLE_ASCII_RE.test(value);
}

// Returns an error message, or null if every value that is set is valid. Empty values mean "no change".
export function validateSystemSettings({
  deviceName,
  userPassword,
  wifiName,
  wifiPassword,
}: SystemSettingsInput): string | null {
  if (deviceName && !HOSTNAME_RE.test(deviceName)) {
    return "Device name must be 1-63 letters, numbers or hyphens, and cannot start or end with a hyphen.";
  }
  if (userPassword && !isValidSecret(userPassword, 8, 64)) {
    return "Password must be 8-64 printable ASCII characters.";
  }
  if (wifiName && !SSID_RE.test(wifiName)) {
    return "Wi-Fi name must be 1-32 letters, numbers or hyphens.";
  }
  if (wifiPassword && !isValidSecret(wifiPassword, 8, 63)) {
    return "Wi-Fi password must be 8-63 printable ASCII characters.";
  }
  return null;
}
