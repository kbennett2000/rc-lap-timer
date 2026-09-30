import { describe, expect, it } from "vitest";
import { validateSystemSettings } from "./system-settings";

describe("validateSystemSettings", () => {
  it("accepts an empty change set", () => {
    expect(validateSystemSettings({})).toBeNull();
    expect(validateSystemSettings({ deviceName: "", userPassword: "" })).toBeNull();
  });

  it("accepts valid values", () => {
    expect(
      validateSystemSettings({
        deviceName: "rc-lap-timer",
        userPassword: "correct horse",
        wifiName: "Track-WiFi",
        wifiPassword: "12345678",
      }),
    ).toBeNull();
  });

  it.each([
    ["-leading", "a leading hyphen"],
    ["trailing-", "a trailing hyphen"],
    ["has space", "a space"],
    ["x".repeat(64), "64 characters"],
    ["$(id)", "shell syntax"],
    ["name;reboot", "a semicolon"],
  ])("rejects device name %j (%s)", (deviceName) => {
    expect(validateSystemSettings({ deviceName })).toMatch(/^Device name/);
  });

  it("accepts a 63-character device name", () => {
    expect(validateSystemSettings({ deviceName: "a".repeat(63) })).toBeNull();
  });

  it.each([
    ["short12", "7 characters"],
    ["x".repeat(65), "65 characters"],
    ["newline\ninside", "a newline"],
    ["tab\there!", "a tab"],
    ["pässwörd123", "non-ASCII"],
  ])("rejects password %j (%s)", (userPassword) => {
    expect(validateSystemSettings({ userPassword })).toMatch(/^Password/);
  });

  it("rejects Wi-Fi names with anything but letters, numbers and hyphens", () => {
    expect(validateSystemSettings({ wifiName: "my wifi" })).toMatch(/^Wi-Fi name/);
    expect(validateSystemSettings({ wifiName: "x".repeat(33) })).toMatch(/^Wi-Fi name/);
  });

  it("limits Wi-Fi passwords to 8-63 printable characters", () => {
    expect(validateSystemSettings({ wifiPassword: "1234567" })).toMatch(/^Wi-Fi password/);
    expect(validateSystemSettings({ wifiPassword: "x".repeat(64) })).toMatch(/^Wi-Fi password/);
    expect(validateSystemSettings({ wifiPassword: "x".repeat(63) })).toBeNull();
  });
});
