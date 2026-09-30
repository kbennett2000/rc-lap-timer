// src/services/ledDevice.ts

// The patterns the Remote LED display knows (handlePatternGet in remote_led/RemoteLED.cpp).
export type LedPattern = "rc10" | "johnny5" | "slash" | "upgrayedd" | "doneflag" | "racecar" | "stopwatch";

const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

// Whole numbers from 0 to 255, as the display takes them.
const level = (value: number) => Math.round(Math.max(0, Math.min(255, value)));

export class LEDDeviceService {
  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch("/api/led/status");
      const data = await response.json();
      return data.status === "connected";
    } catch {
      return false;
    }
  }

  async setColor(r: number, g: number, b: number): Promise<void> {
    const response = await post("/api/led/rgb", { r: level(r), g: level(g), b: level(b) });
    if (!response.ok) {
      throw new Error("Failed to set LED color");
    }
  }

  async displayMessage(title: string, message: string): Promise<void> {
    const response = await post("/api/led/text", { title, message });
    if (!response.ok) {
      throw new Error("Failed to display message");
    }
  }

  async runPattern(pattern: LedPattern): Promise<void> {
    const response = await post("/api/led/pattern", { name: pattern });
    if (!response.ok) {
      throw new Error("Failed to run pattern");
    }
  }
}
