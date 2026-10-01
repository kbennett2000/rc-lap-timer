"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logger";
import { cameraGone, parseSpeed, pictureConstraints, videoConstraints, type CameraSpeed } from "./constraints";

const CAMERA_KEY = "rc-lap-timer-camera-id";
const SPEED_KEY = "rc-lap-timer-camera-speed";

export type CameraStatus = "off" | "starting" | "on" | "error";

function savedCameraId(): string {
  try {
    return localStorage.getItem(CAMERA_KEY) ?? "";
  } catch {
    return "";
  }
}

function savedSpeed(): CameraSpeed {
  try {
    return parseSpeed(localStorage.getItem(SPEED_KEY));
  } catch {
    return "fast";
  }
}

// The frames a second the camera says it sends, if it says.
function frameRateOf(stream: MediaStream | null): number | null {
  const rate = stream?.getVideoTracks()[0]?.getSettings().frameRate;
  return typeof rate === "number" && Number.isFinite(rate) ? rate : null;
}

// One camera stream for the motion detector. start() reuses a live stream instead of asking again (iOS asks for
// permission on every getUserMedia call in a Home Screen app); the stream stops on stop() and on unmount.
export function useCamera() {
  const streamRef = useRef<MediaStream | null>(null);
  const startingRef = useRef<Promise<MediaStream> | null>(null);
  const [status, setStatus] = useState<CameraStatus>("off");
  const [error, setError] = useState("");
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState(savedCameraId);
  const cameraIdRef = useRef(cameraId);
  const [speed, setSpeed] = useState<CameraSpeed>("fast");
  const speedRef = useRef<CameraSpeed>("fast");
  const [frameRate, setFrameRate] = useState<number | null>(null);

  // Read back after mounting: the page is first drawn without storage.
  useEffect(() => {
    speedRef.current = savedSpeed();
    setSpeed(speedRef.current);
  }, []);

  const rememberCamera = useCallback((id: string) => {
    cameraIdRef.current = id;
    setCameraId(id);
    try {
      if (id) localStorage.setItem(CAMERA_KEY, id);
      else localStorage.removeItem(CAMERA_KEY);
    } catch {
      // not remembered; still used for this page
    }
  }, []);
  const forgetCamera = useCallback(() => rememberCamera(""), [rememberCamera]);

  const refreshCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setCameras(devices.filter((device) => device.kind === "videoinput" && device.deviceId));
    } catch (err) {
      logger.warn("Could not list cameras:", err);
    }
  }, []);

  const start = useCallback(async (): Promise<MediaStream> => {
    const live = streamRef.current;
    if (live && live.getVideoTracks().some((track) => track.readyState === "live")) return live;
    if (startingRef.current) return startingRef.current;

    setStatus("starting");
    setError("");
    const id = cameraIdRef.current;
    const open = (cameraId: string) =>
      navigator.mediaDevices.getUserMedia({ audio: false, video: videoConstraints(cameraId, speedRef.current) });
    const starting = open(id)
      .catch((err) => {
        if (!id || !cameraGone(err)) throw err;
        // The chosen camera has gone: use the default one, and forget the choice.
        logger.warn("The chosen camera isn't there any more, so the default camera is used:", err);
        forgetCamera();
        return open("");
      })
      .then((stream) => {
        streamRef.current = stream;
        setFrameRate(frameRateOf(stream));
        setStatus("on");
        void refreshCameras(); // labels are only available after permission is granted
        return stream;
      })
      .catch((err) => {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Camera access error");
        throw err;
      })
      .finally(() => {
        startingRef.current = null;
      });
    startingRef.current = starting;
    return starting;
  }, [refreshCameras, forgetCamera]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setFrameRate(null);
    setStatus("off");
  }, []);

  // Switching cameras while the stream is on restarts it with the new one.
  const chooseCamera = useCallback(
    async (id: string) => {
      rememberCamera(id);
      if (streamRef.current) {
        stop();
        await start();
      }
    },
    [start, stop, rememberCamera],
  );

  // A new speed applies to a running camera at once, without restarting it.
  const chooseSpeed = useCallback(async (next: CameraSpeed) => {
    speedRef.current = next;
    setSpeed(next);
    try {
      localStorage.setItem(SPEED_KEY, next);
    } catch {
      // not remembered; still used for this page
    }
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || track.readyState !== "live") return;
    try {
      await track.applyConstraints(pictureConstraints(next));
    } catch (err) {
      logger.warn("The camera didn't take the new frame rate:", err);
    }
    setFrameRate(frameRateOf(streamRef.current));
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  return { streamRef, status, error, start, stop, cameras, cameraId, chooseCamera, speed, chooseSpeed, frameRate };
}
