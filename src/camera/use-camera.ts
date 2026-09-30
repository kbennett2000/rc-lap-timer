"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logger";

const CAMERA_KEY = "rc-lap-timer-camera-id";

export type CameraStatus = "off" | "starting" | "on" | "error";

function savedCameraId(): string {
  try {
    return localStorage.getItem(CAMERA_KEY) ?? "";
  } catch {
    return "";
  }
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
    const starting = navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          // A chosen camera, because iOS can otherwise switch lenses mid-stream (each switch looks like motion).
          ...(id ? { deviceId: { ideal: id } } : { facingMode: { ideal: "environment" } }),
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      .then((stream) => {
        streamRef.current = stream;
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
  }, [refreshCameras]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStatus("off");
  }, []);

  // Switching cameras while the stream is on restarts it with the new one.
  const chooseCamera = useCallback(
    async (id: string) => {
      cameraIdRef.current = id;
      setCameraId(id);
      try {
        if (id) localStorage.setItem(CAMERA_KEY, id);
        else localStorage.removeItem(CAMERA_KEY);
      } catch {
        // not remembered; still used for this page
      }
      if (streamRef.current) {
        stop();
        await start();
      }
    },
    [start, stop],
  );

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  return { streamRef, status, error, start, stop, cameras, cameraId, chooseCamera };
}
