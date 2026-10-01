import { describe, expect, it } from "vitest";
import { cameraGone, parseSpeed, pictureConstraints, videoConstraints } from "./constraints";

describe("videoConstraints", () => {
  it("asks for the chosen camera exactly, at up to 60 frames a second", () => {
    expect(videoConstraints("abc")).toEqual({
      deviceId: { exact: "abc" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 60 },
    });
  });

  it("asks for the back camera when none is chosen", () => {
    expect(videoConstraints("")).toMatchObject({ facingMode: { ideal: "environment" } });
    expect(videoConstraints("")).not.toHaveProperty("deviceId");
  });

  it("asks for 30 frames a second to save battery", () => {
    expect(videoConstraints("abc", "saver")).toMatchObject({ frameRate: { ideal: 30 } });
    expect(pictureConstraints("saver")).toEqual({
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
    });
  });
});

describe("parseSpeed", () => {
  it("reads back a stored speed, and is fast for anything else", () => {
    expect(parseSpeed("saver")).toBe("saver");
    expect(parseSpeed("fast")).toBe("fast");
    expect(parseSpeed(null)).toBe("fast");
    expect(parseSpeed("ludicrous")).toBe("fast");
  });
});

describe("cameraGone", () => {
  it("is a camera that can't be found, not one that's refused or busy", () => {
    expect(cameraGone({ name: "OverconstrainedError" })).toBe(true);
    expect(cameraGone({ name: "NotFoundError" })).toBe(true);
    expect(cameraGone({ name: "NotAllowedError" })).toBe(false);
    expect(cameraGone({ name: "NotReadableError" })).toBe(false);
    expect(cameraGone(new Error("other"))).toBe(false);
  });
});
