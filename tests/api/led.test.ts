// The Remote LED display's routes (/api/led): the timer's pages post JSON, and the routes pass each command on to the
// display (remote_led/RemoteLED.cpp) with every value encoded. A fake display stands in for it, so the server must be
// started with LED_DEVICE_IP=127.0.0.1:3199, as CI and the steps in api.test.ts do.

import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { BASE, call } from "./helpers";

const DISPLAY = process.env.LED_DEVICE_IP ?? "127.0.0.1:3199";

let display: Server;
let received: URL[] = [];
let answer = 200;

const commands = () => received.map((url) => `${url.pathname}${url.search}`);

beforeAll(async () => {
  display = createServer((request, response) => {
    received.push(new URL(request.url ?? "/", `http://${DISPLAY}`));
    response.writeHead(answer).end("OK");
  });
  const [host, port] = DISPLAY.split(":");
  await new Promise<void>((resolve) => display.listen(Number(port), host, resolve));
});

afterAll(() => new Promise<void>((resolve) => (display.listening ? display.close(() => resolve()) : resolve())));

beforeEach(() => {
  received = [];
  answer = 200;
});

describe("the LED display routes (/api/led)", () => {
  it("pass a colour on to the display", async () => {
    expect(await call("POST", "/api/led/rgb", { r: 0, g: 128, b: 255 })).toEqual({
      status: 200,
      json: { success: true },
    });
    // No command reaching the fake display means the server wasn't started with LED_DEVICE_IP=127.0.0.1:3199.
    expect(commands()).toEqual(["/rgb?r=0&g=128&b=255"]);
  });

  it("pass text on intact", async () => {
    const message = "Kris & Sam #1: 100% 🏁 ?lap=2";
    expect((await call("POST", "/api/led/text", { title: " Johnny 5", message })).status).toBe(200);
    expect(received.map((url) => url.pathname)).toEqual(["/text"]);
    expect(Object.fromEntries(received[0].searchParams)).toEqual({ title: " Johnny 5", message });
  });

  it("leave the title to the display when there isn't one", async () => {
    expect((await call("POST", "/api/led/text", { message: "Hello" })).status).toBe(200);
    expect(commands()).toEqual(["/text?message=Hello"]);
  });

  it("pass a pattern on", async () => {
    expect((await call("POST", "/api/led/pattern", { name: "johnny5" })).status).toBe(200);
    expect(commands()).toEqual(["/pattern?name=johnny5"]);
  });

  it.each([
    ["/api/led/rgb", { r: 0, g: 256, b: 0 }],
    ["/api/led/rgb", { r: 0, g: 1.5, b: 0 }],
    ["/api/led/rgb", { r: -1, g: 0, b: 0 }],
    ["/api/led/rgb", { r: "0", g: 0, b: 0 }],
    ["/api/led/rgb", { r: 0, g: 0 }],
    ["/api/led/text", { title: "No message" }],
    ["/api/led/text", { message: "x".repeat(201) }],
    ["/api/led/text", { title: 5, message: "Hello" }],
    ["/api/led/pattern", { name: "johnny5&r=255" }],
    ["/api/led/pattern", { name: "../reset" }],
    ["/api/led/pattern", { name: "" }],
    ["/api/led/pattern", {}],
    ["/api/led/pattern", []],
  ])("refuse %s with %j, without calling the display", async (path, body) => {
    expect((await call("POST", path, body)).status).toBe(400);
    expect(received).toEqual([]);
  });

  it("only take commands as posts", async () => {
    for (const path of ["/api/led/rgb?r=0&g=0&b=0", "/api/led/text?message=hi", "/api/led/pattern?name=johnny5"]) {
      expect((await fetch(`${BASE}${path}`)).status, path).toBe(405);
    }
    expect(received).toEqual([]);
  });

  it("say when the display refuses a command, without giving its address", async () => {
    answer = 400; // RemoteLED.cpp's "Unknown pattern"
    const { status, json } = await call("POST", "/api/led/pattern", { name: "nosuchpattern" });
    expect(status).toBe(500);
    expect(json.error).toBe("Failed to communicate with LED device");
    expect(JSON.stringify(json)).not.toContain(DISPLAY);
  });

  it("report whether the display is there", async () => {
    expect((await call("GET", "/api/led/status")).json.status).toBe("connected");
    answer = 500;
    expect((await call("GET", "/api/led/status")).json.status).toBe("disconnected");
  });

  it("say when the display isn't there", async () => {
    await new Promise<void>((resolve) => display.close(() => resolve()));
    const { status, json } = await call("POST", "/api/led/rgb", { r: 1, g: 2, b: 3 });
    expect(status).toBe(500);
    expect(json.error).toBe("Failed to communicate with LED device");
  });
});
