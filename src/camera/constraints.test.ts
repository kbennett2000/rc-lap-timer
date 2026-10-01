import { describe, expect, it } from "vitest";
import { cameraGone, videoConstraints } from "./constraints";

describe("videoConstraints", () => {
  it("asks for the chosen camera exactly", () => {
    expect(videoConstraints("abc")).toEqual({
      deviceId: { exact: "abc" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    });
  });

  it("asks for the back camera when none is chosen", () => {
    expect(videoConstraints("")).toMatchObject({ facingMode: { ideal: "environment" } });
    expect(videoConstraints("")).not.toHaveProperty("deviceId");
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
