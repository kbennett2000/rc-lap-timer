"use client";

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { RotateCw } from "lucide-react";
import { beep } from "@/audio";
import { useCamera } from "@/camera/use-camera";
import { logger } from "@/lib/logger";
import { now } from "@/timing/clock";

export interface MotionDetectorHandle {
  start: () => Promise<void>;
  stop: () => void;
}

interface MotionDetectorProps {
  // Called for each detection while the camera is on (not in preview), with the frame's timestamp.
  onMotionDetected?: (changePercent: number, at: number) => void;
  // Called inside the Preview and Cam On taps, so the caller can unlock audio and keep the screen on.
  onUserStart?: () => void;
  onCameraChange?: (on: boolean) => void;
  // Beep on detections while previewing (during a run, the practice screen plays the lap sound).
  soundOn?: boolean;
  className?: string;
}

interface DetectorSettings {
  sensitivity: number;
  threshold: number;
  cooldown: number;
  framesToSkip: number;
}

interface MotionSettings extends DetectorSettings {
  id: string;
  name: string;
}

const DEFAULT_SETTINGS: DetectorSettings = {
  sensitivity: 100,
  threshold: 1.0,
  cooldown: 10000,
  framesToSkip: 60,
};

const ROTATIONS = [0, 90, 180, 270];

export const MotionDetector = forwardRef<MotionDetectorHandle, MotionDetectorProps>(function MotionDetector(
  { onMotionDetected, onUserStart, onCameraChange, soundOn = false, className = "" },
  ref,
) {
  const camera = useCamera();
  const { start: startCamera, stop: stopCamera } = camera;
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previousFrameRef = useRef<ImageData | null>(null);
  const lastMotionTimeRef = useRef(0);
  const frameCountRef = useRef(0);
  const animationFrameRef = useRef<number>();
  const activeRef = useRef(false);

  const [settings, setSettings] = useState<DetectorSettings>(DEFAULT_SETTINGS);
  const [isRunning, setIsRunning] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [error, setError] = useState("");
  const [lastChangePercent, setLastChangePercent] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [savedSettings, setSavedSettings] = useState<MotionSettings[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newSettingsName, setNewSettingsName] = useState("");
  const [saveError, setSaveError] = useState("");
  const [detectedMotionStats, setDetectedMotionStats] = useState("");
  const [saveMDImages, setSaveMDImages] = useState(false);
  const [rotation, setRotation] = useState(0);

  // Latest values for the frame loop, which outlives any single render.
  const latest = useRef({ settings, isPreviewing, saveMDImages, soundOn, onMotionDetected, onCameraChange });
  latest.current = { settings, isPreviewing, saveMDImages, soundOn, onMotionDetected, onCameraChange };

  useEffect(() => {
    loadSavedSettings();
  }, []);

  const loadSavedSettings = async () => {
    try {
      const response = await fetch("/api/motion-settings");
      if (response.ok) setSavedSettings(await response.json());
    } catch (err) {
      logger.error("Error loading settings:", err);
    }
  };

  const handleSaveSettings = async () => {
    if (!newSettingsName.trim()) {
      setSaveError("Please enter a name");
      return;
    }
    if (savedSettings.some((s) => s.name === newSettingsName)) {
      setSaveError("This name already exists");
      return;
    }
    try {
      const response = await fetch("/api/motion-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSettingsName, ...settings }),
      });
      if (response.ok) {
        await loadSavedSettings();
        setShowSaveDialog(false);
        setNewSettingsName("");
        setSaveError("");
      }
    } catch (err) {
      logger.error("Error saving settings:", err);
    }
  };

  const handleLoadSettings = (saved: MotionSettings) => {
    setSettings({
      sensitivity: saved.sensitivity,
      threshold: saved.threshold,
      cooldown: saved.cooldown,
      framesToSkip: saved.framesToSkip,
    });
  };

  const detectMotion = useCallback(() => {
    if (!activeRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    if (!video || !canvas || !ctx || video.videoWidth === 0) {
      animationFrameRef.current = requestAnimationFrame(detectMotion);
      return;
    }

    // Follow the video size, which changes when the phone rotates.
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      previousFrameRef.current = null;
    }
    ctx.drawImage(video, 0, 0);
    const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const at = now();
    const { settings: current, isPreviewing: previewing } = latest.current;

    frameCountRef.current++;
    const previous = previousFrameRef.current;
    if (previous && frameCountRef.current > current.framesToSkip) {
      let changedPixels = 0;
      for (let i = 0; i < currentFrame.data.length; i += 4) {
        if (
          Math.abs(currentFrame.data[i] - previous.data[i]) > current.sensitivity ||
          Math.abs(currentFrame.data[i + 1] - previous.data[i + 1]) > current.sensitivity ||
          Math.abs(currentFrame.data[i + 2] - previous.data[i + 2]) > current.sensitivity
        ) {
          changedPixels++;
        }
      }
      const changePercent = (changedPixels / (currentFrame.width * currentFrame.height)) * 100;
      setLastChangePercent(changePercent);

      if (changePercent > current.threshold && at - lastMotionTimeRef.current > current.cooldown) {
        lastMotionTimeRef.current = at;
        setDetectedMotionStats("Motion detected: " + changePercent.toFixed(1));
        if (latest.current.saveMDImages) saveToGallery(canvas, changePercent);
        if (previewing) {
          if (latest.current.soundOn) void beep();
        } else {
          latest.current.onMotionDetected?.(changePercent, at);
        }
      }
    }
    previousFrameRef.current = currentFrame;
    animationFrameRef.current = requestAnimationFrame(detectMotion);
  }, []);

  const saveToGallery = async (canvas: HTMLCanvasElement, changePercent: number) => {
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
      if (!blob) return;
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `rc-lap-${timestamp}-${changePercent.toFixed(1)}pct.jpg`;

      // The Web Share API saves to the photo library on most phones.
      if (typeof navigator.share === "function" && typeof navigator.canShare === "function") {
        try {
          await navigator.share({ files: [new File([blob], filename, { type: "image/jpeg" })] });
          return;
        } catch (err) {
          logger.error("Share failed, falling back to download:", err);
        }
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      logger.error("Error saving image to gallery:", err);
    }
  };

  const stopLoop = () => {
    activeRef.current = false;
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = undefined;
    previousFrameRef.current = null;
    lastMotionTimeRef.current = 0;
    frameCountRef.current = 0;
  };

  const handleStop = useCallback(() => {
    stopLoop();
    stopCamera();
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsRunning(false);
    setIsPreviewing(false);
    latest.current.onCameraChange?.(false);
  }, [stopCamera]);

  const handleStart = useCallback(async () => {
    setError("");
    try {
      const stream = await startCamera();
      const video = videoRef.current;
      if (!video) return;
      if (video.srcObject !== stream) video.srcObject = stream;
      if (video.readyState < 2) {
        await new Promise<void>((resolve) => video.addEventListener("loadeddata", () => resolve(), { once: true }));
      }
      setIsRunning(true);
      latest.current.onCameraChange?.(true);
      if (!activeRef.current) {
        activeRef.current = true;
        frameCountRef.current = 0;
        detectMotion();
      }
    } catch (err) {
      logger.error("Start error:", err);
      setError("Failed to start: " + (err instanceof Error ? err.message : String(err)));
      handleStop();
      throw err;
    }
  }, [startCamera, detectMotion, handleStop]);

  useImperativeHandle(ref, () => ({ start: handleStart, stop: handleStop }), [handleStart, handleStop]);

  // Stop the frame loop on unmount (useCamera stops the stream).
  useEffect(() => stopLoop, []);

  const handlePreviewToggle = async () => {
    if (isPreviewing) {
      handleStop();
      return;
    }
    onUserStart?.();
    setIsLoading(true);
    setIsPreviewing(true);
    try {
      await handleStart();
    } catch {
      // error shown by handleStart
    } finally {
      setIsLoading(false);
    }
  };

  const handleCamOn = async () => {
    onUserStart?.();
    setIsLoading(true);
    try {
      await handleStart();
    } catch {
      // error shown by handleStart
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full"
          style={rotation ? { transform: `rotate(${rotation}deg)` } : undefined}
        />
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {(error || camera.error) && <div className="text-red-500 bg-red-50 p-2 rounded">{error || camera.error}</div>}

      <div className="space-y-4">
        <div className="pt-2 border-t">
          {isPreviewing && <div className="text-sm">Motion Detected Stats: {detectedMotionStats}</div>}
          {isPreviewing && lastChangePercent !== null && (
            <div className="text-sm">Last Change: {lastChangePercent.toFixed(1)}%</div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={handlePreviewToggle} className="px-4 py-2 bg-gray-500 text-white rounded disabled:bg-gray-300">
          {isPreviewing ? "Stop Preview" : "Preview"}
        </button>
        <button
          onClick={handleCamOn}
          disabled={isRunning || isLoading || isPreviewing}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
        >
          Cam On
        </button>
        <button
          onClick={handleStop}
          disabled={(!isRunning && !isPreviewing) || isLoading}
          className="px-4 py-2 bg-red-500 text-white rounded disabled:bg-gray-300"
        >
          Cam Off
        </button>
        <button
          onClick={() => setRotation((r) => ROTATIONS[(ROTATIONS.indexOf(r) + 1) % ROTATIONS.length])}
          className="px-3 py-2 border rounded flex items-center gap-1 text-sm"
          title="Rotate the preview if it shows sideways. Detection isn't affected."
        >
          <RotateCw className="h-4 w-4" />
          Rotate preview
        </button>
      </div>

      {camera.cameras.length > 1 && (
        <div className="space-y-1">
          <label htmlFor="cameraSelect" className="block text-sm">
            Camera
          </label>
          <select
            id="cameraSelect"
            value={camera.cameraId}
            onChange={(e) => camera.chooseCamera(e.target.value).catch(() => {})}
            className="px-3 py-2 border rounded w-full"
          >
            <option value="">Default (back camera)</option>
            {camera.cameras.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${index + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Control Settings */}
      <div className="space-y-3 p-4 bg-gray-50 rounded">
        <div>
          <label className="block text-sm mb-1">Sensitivity ({(205 - settings.sensitivity).toFixed(0)}/200)</label>
          <input
            type="range"
            min="5"
            max="200"
            value={205 - settings.sensitivity}
            onChange={(e) => setSettings((prev) => ({ ...prev, sensitivity: 205 - Number(e.target.value) }))}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Threshold ({settings.threshold}%)</label>
          <input
            type="range"
            min="0.1"
            max="10.0"
            step="0.1"
            value={settings.threshold}
            onChange={(e) => setSettings((prev) => ({ ...prev, threshold: Number(e.target.value) }))}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Cooldown ({settings.cooldown}ms)</label>
          <input
            type="range"
            min="100"
            max="25000"
            step="100"
            value={settings.cooldown}
            onChange={(e) => setSettings((prev) => ({ ...prev, cooldown: Number(e.target.value) }))}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Frames to Skip ({settings.framesToSkip})</label>
          <input
            type="range"
            min="1"
            max="240"
            value={settings.framesToSkip}
            onChange={(e) => setSettings((prev) => ({ ...prev, framesToSkip: Number(e.target.value) }))}
            className="w-full"
          />
        </div>

        <div>Camera Settings:</div>
        <div className="flex gap-2 pt-4">
          <button onClick={() => setShowSaveDialog(true)} className="px-4 py-2 bg-green-500 text-white rounded">
            Save
          </button>

          <select
            onChange={(e) => {
              const selected = savedSettings.find((s) => s.id === e.target.value);
              if (selected) handleLoadSettings(selected);
            }}
            value=""
            className="px-4 py-2 border rounded w-[180px]"
          >
            <option value="" disabled>
              Load settings...
            </option>
            {savedSettings.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 pt-4">
          <input
            type="checkbox"
            id="saveMDImagesLocally"
            checked={saveMDImages}
            onChange={(e) => setSaveMDImages(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <label htmlFor="saveMDImagesLocally" className="text-sm font-medium">
            Save MD Images
          </label>
        </div>

        {showSaveDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-4 rounded-lg space-y-4">
              <h3 className="font-bold">Save Settings</h3>
              <input
                type="text"
                value={newSettingsName}
                onChange={(e) => setNewSettingsName(e.target.value)}
                placeholder="Enter settings name"
                className="px-4 py-2 border rounded w-full"
              />
              {saveError && <p className="text-red-500 text-sm">{saveError}</p>}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowSaveDialog(false);
                    setNewSettingsName("");
                    setSaveError("");
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded"
                >
                  Cancel
                </button>
                <button onClick={handleSaveSettings} className="px-4 py-2 bg-blue-500 text-white rounded">
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
