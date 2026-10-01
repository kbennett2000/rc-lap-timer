// What the motion detector asks the camera for.

// "fast": as many frames a second as the camera can, up to 60, so a crossing is timed to the nearest 1/60 s. "saver":
// 30, which uses less battery and keeps the phone cooler.
export type CameraSpeed = "fast" | "saver";

export const FRAME_RATES: Record<CameraSpeed, number> = { fast: 60, saver: 30 };

export function parseSpeed(value: unknown): CameraSpeed {
  return value === "saver" ? "saver" : "fast";
}

// A chosen camera exactly (Chrome ignores an "ideal" one and opens the default camera), or else the back camera. A
// chosen camera, because iOS can otherwise switch lenses mid-stream, and each switch looks like motion.
export function videoConstraints(cameraId: string, speed: CameraSpeed = "fast"): MediaTrackConstraints {
  return {
    ...(cameraId ? { deviceId: { exact: cameraId } } : { facingMode: { ideal: "environment" } }),
    ...pictureConstraints(speed),
  };
}

// The picture's size and frame rate, which a running camera can change without restarting.
export function pictureConstraints(speed: CameraSpeed): MediaTrackConstraints {
  return { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: FRAME_RATES[speed] } };
}

// Whether a getUserMedia failure means the chosen camera isn't there any more (unplugged, or a new id after the
// browser's site data was cleared), so the default camera should be used instead.
export function cameraGone(error: unknown): boolean {
  const name = typeof error === "object" && error !== null && "name" in error ? error.name : "";
  return name === "OverconstrainedError" || name === "NotFoundError";
}
