// src/services/ledDevice.ts

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
    const response = await fetch(`/api/led/rgb?r=${r}&g=${g}&b=${b}`);
    if (!response.ok) {
      throw new Error("Failed to set LED color");
    }
  }

  async displayMessage(title: string, message: string): Promise<void> {
    const response = await fetch(`/api/led/text?title=${encodeURIComponent(title)}&message=${encodeURIComponent(message)}`);
    if (!response.ok) {
      throw new Error("Failed to display message");
    }
  }

  async runPattern(pattern: "police" | "rainbow" | "strobe"): Promise<void> {
    const response = await fetch(`/api/led/pattern?name=${pattern}`);
    if (!response.ok) {
      throw new Error("Failed to run pattern");
    }
  }
}
