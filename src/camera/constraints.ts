// What the motion detector asks the camera for.

// A chosen camera exactly (Chrome ignores an "ideal" one and opens the default camera), or else the back camera. A
// chosen camera, because iOS can otherwise switch lenses mid-stream, and each switch looks like motion.
export function videoConstraints(cameraId: string): MediaTrackConstraints {
  return {
    ...(cameraId ? { deviceId: { exact: cameraId } } : { facingMode: { ideal: "environment" } }),
    width: { ideal: 1280 },
    height: { ideal: 720 },
  };
}

// Whether a getUserMedia failure means the chosen camera isn't there any more (unplugged, or a new id after the
// browser's site data was cleared), so the default camera should be used instead.
export function cameraGone(error: unknown): boolean {
  const name = typeof error === "object" && error !== null && "name" in error ? error.name : "";
  return name === "OverconstrainedError" || name === "NotFoundError";
}
