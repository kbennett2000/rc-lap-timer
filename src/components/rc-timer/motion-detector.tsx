import React, { useEffect, useRef, useState, useCallback } from "react";

interface MotionDetectorProps {
  onMotionDetected?: (changePercent: number) => void;
  className?: string;
  // Add ref for external control
  controlRef?: React.RefObject<{
    stop: () => void;
  }>;
}

interface DetectorSettings {
  sensitivity: number;
  threshold: number;
  cooldown: number;
  framesToSkip: number;
  enableAudio: boolean;
  enableDebugView: boolean;
}

interface MotionSettings {
  id: string;
  name: string;
  sensitivity: number;
  threshold: number;
  cooldown: number;
  framesToSkip: number;
}

const DEFAULT_SETTINGS: DetectorSettings = {
  sensitivity: 50,
  threshold: 2.0,
  cooldown: 5000,
  framesToSkip: 10,
  enableAudio: true,
  enableDebugView: true,
};

export const MotionDetector: React.FC<MotionDetectorProps> = ({ onMotionDetected, className = "", controlRef }) => {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const previousFrameRef = useRef<ImageData | null>(null);
  const lastMotionTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number>();

  // Ref for settings to access latest values in callbacks
  const settingsRef = useRef<DetectorSettings>(DEFAULT_SETTINGS);

  // Add ref for initial frames skip
  const frameCountRef = useRef<number>(0);

  // State
  const [settings, setSettings] = useState<DetectorSettings>(DEFAULT_SETTINGS);
  const [isRunning, setIsRunning] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [error, setError] = useState<string>("");
  const [motionEvents, setMotionEvents] = useState(0);
  const [lastChangePercent, setLastChangePercent] = useState<number | null>(null);
  const [isStoppingRef] = useState({ current: false });
  const [isLoading, setIsLoading] = useState(false);
  const [savedSettings, setSavedSettings] = useState<MotionSettings[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newSettingsName, setNewSettingsName] = useState("");
  const [saveError, setSaveError] = useState("");

  const isActiveRef = useRef(true);
  const isPreviewingRef = useRef(isPreviewing);

  useEffect(() => {
    isPreviewingRef.current = isPreviewing;
  }, [isPreviewing]);

  useEffect(() => {
    loadSavedSettings();
  }, []);

  // Keep settingsRef in sync with settings
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const loadSavedSettings = async () => {
    try {
      const response = await fetch("/api/motion-settings");
      if (response.ok) {
        const data = await response.json();
        setSavedSettings(data);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
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
        body: JSON.stringify({
          name: newSettingsName,
          sensitivity: settings.sensitivity,
          threshold: settings.threshold,
          cooldown: settings.cooldown,
          framesToSkip: settings.framesToSkip,
        }),
      });

      if (response.ok) {
        await loadSavedSettings();
        setShowSaveDialog(false);
        setNewSettingsName("");
        setSaveError("");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  };

  const handleLoadSettings = (savedSettings: MotionSettings) => {
    setSettings((prev) => ({
      ...prev,
      sensitivity: savedSettings.sensitivity,
      threshold: savedSettings.threshold,
      cooldown: savedSettings.cooldown,
      framesToSkip: savedSettings.framesToSkip,
    }));
  };

  // Add this helper function near the top of the component
  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }
  }, []);

  // Audio handling
  const initAudio = useCallback(async () => {
    if (!settings.enableAudio) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }
    } catch (err) {
      console.error("Audio initialization error:", err);
    }
  }, [settings.enableAudio]);

  const playBeep = useCallback(() => {
    if (!settings.enableAudio || !audioContextRef.current) return;

    try {
      const context = audioContextRef.current;
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(440, context.currentTime);
      gainNode.gain.setValueAtTime(0.5, context.currentTime);

      oscillator.start();
      oscillator.stop(context.currentTime + 0.2);
    } catch (err) {
      console.error("Error playing beep:", err);
    }
  }, [settings.enableAudio]);

  // Camera setup
  const setupCamera = useCallback(async () => {
    try {
      // Clean up any existing stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        mediaStreamRef.current = stream;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Camera access error");
      throw err;
    }
  }, []);

  // Motion detection
  // Modified motion detection to handle frame skipping
  const detectMotion = useCallback(() => {
    if (!isActiveRef.current) {
      return;
    }

    if (!videoRef.current || !canvasRef.current || !debugCanvasRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const debugCanvas = debugCanvasRef.current;
    const ctx = canvas.getContext("2d");
    const debugCtx = debugCanvas.getContext("2d");

    if (!ctx || !debugCtx) {
      return;
    }

    // Make sure we're drawing the current video frame
    ctx.drawImage(video, 0, 0);
    const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (settingsRef.current.enableDebugView) {
      debugCtx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
    }

    frameCountRef.current++;
    console.log("Processing frame:", frameCountRef.current);

    // Use settingsRef.current instead of settings
    if (previousFrameRef.current && frameCountRef.current > settingsRef.current.framesToSkip) {
      let changedPixels = 0;
      const debugFrame = settingsRef.current.enableDebugView ? debugCtx.createImageData(canvas.width, canvas.height) : null;

      for (let i = 0; i < currentFrame.data.length; i += 4) {
        const rDiff = Math.abs(currentFrame.data[i] - previousFrameRef.current.data[i]);
        const gDiff = Math.abs(currentFrame.data[i + 1] - previousFrameRef.current.data[i + 1]);
        const bDiff = Math.abs(currentFrame.data[i + 2] - previousFrameRef.current.data[i + 2]);

        if (rDiff > settingsRef.current.sensitivity || gDiff > settingsRef.current.sensitivity || bDiff > settingsRef.current.sensitivity) {
          changedPixels++;
          if (debugFrame) {
            debugFrame.data[i] = 255;
            debugFrame.data[i + 1] = 0;
            debugFrame.data[i + 2] = 0;
            debugFrame.data[i + 3] = 128;
          }
        }
      }

      if (settingsRef.current.enableDebugView && debugFrame) {
        debugCtx.putImageData(debugFrame, 0, 0);
      }

      const frameSize = currentFrame.width * currentFrame.height;
      const changePercent = (changedPixels / frameSize) * 100;
      setLastChangePercent(changePercent);
      console.log("Change percent:", changePercent.toFixed(2) + "%");

      if (changePercent > settingsRef.current.threshold) {
        const now = Date.now();
        if (now - lastMotionTimeRef.current > settingsRef.current.cooldown) {
          console.log("Motion detected!");
          playBeep();
          setMotionEvents((prev) => prev + 1);
          if (!isPreviewingRef.current) {
            onMotionDetected?.(changePercent);
          }
          lastMotionTimeRef.current = now;
        }
      }
    }

    previousFrameRef.current = currentFrame;

    if (isActiveRef.current) {
      animationFrameRef.current = requestAnimationFrame(detectMotion);
    }
  }, [playBeep, onMotionDetected]);

  const handleStop = useCallback(() => {
    isActiveRef.current = false;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    previousFrameRef.current = null;
    lastMotionTimeRef.current = 0;
    frameCountRef.current = 0; // Reset frame counter

    setIsRunning(false);
    setIsPreviewing(false);
  }, []);

  const handleStart = useCallback(async () => {
    try {
      setError("");
      isActiveRef.current = true;
      frameCountRef.current = 0; // Reset frame counter

      await setupCamera();

      // Wait for video to be ready
      if (videoRef.current) {
        await new Promise<void>((resolve) => {
          if (videoRef.current!.readyState === 4) {
            resolve();
          } else {
            videoRef.current!.addEventListener("loadeddata", () => resolve(), { once: true });
          }
        });
      }

      await initAudio();

      setIsRunning(true);
      detectMotion();
    } catch (err) {
      console.error("Start error:", err);
      setError("Failed to start: " + (err instanceof Error ? err.message : String(err)));
      isActiveRef.current = false;
      handleStop();
    }
  }, [setupCamera, initAudio, detectMotion, handleStop]);

  const handlePreviewToggle = useCallback(async () => {
    if (isPreviewingRef.current) {
      handleStop();
    } else {
      try {
        setError("");
        setIsLoading(true);
        setIsPreviewing(true);
        await handleStart();
      } catch (err) {
        setError("Failed to start preview: " + (err instanceof Error ? err.message : String(err)));
      } finally {
        setIsLoading(false);
      }
    }
  }, [isPreviewing, setupCamera, handleStop]);

  // Expose control methods via ref
  useEffect(() => {
    if (controlRef) {
      controlRef.current = {
        stop: handleStop,
      };
    }
  }, [controlRef, handleStop]);

  // ... (previous useEffect hooks remain the same)
  useEffect(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;

    const handleVideoMetadata = () => {
      if (!videoRef.current || !canvasRef.current || !debugCanvasRef.current) return;
      const { videoWidth, videoHeight } = videoRef.current;
      canvasRef.current.width = videoWidth;
      canvasRef.current.height = videoHeight;
      debugCanvasRef.current.width = videoWidth;
      debugCanvasRef.current.height = videoHeight;
    };

    video.addEventListener("loadedmetadata", handleVideoMetadata);

    return () => {
      video.removeEventListener("loadedmetadata", handleVideoMetadata);
    };
  }, []);

  useEffect(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;

    const handleVideoMetadata = () => {
      if (!videoRef.current || !canvasRef.current || !debugCanvasRef.current) return;

      const { videoWidth, videoHeight } = videoRef.current;

      canvasRef.current.width = videoWidth;
      canvasRef.current.height = videoHeight;
      debugCanvasRef.current.width = videoWidth;
      debugCanvasRef.current.height = videoHeight;
    };

    video.addEventListener("loadedmetadata", handleVideoMetadata);

    return () => {
      video.removeEventListener("loadedmetadata", handleVideoMetadata);
    };
  }, []);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video ref={videoRef} autoPlay playsInline className="w-full" />
        <canvas ref={debugCanvasRef} className={`absolute top-0 left-0 w-full h-full ${settings.enableDebugView && isRunning ? "opacity-50" : "hidden"}`} />
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {error && <div className="text-red-500 bg-red-50 p-2 rounded">{error}</div>}

      <div className="space-y-4">
        {/* Control Buttons */}
        <div className="flex gap-2">
          {/* Preview Button */}
          <button onClick={handlePreviewToggle} className="px-4 py-2 bg-gray-500 text-white rounded disabled:bg-gray-300">
            {isPreviewing ? "Stop Preview" : "Preview"}
          </button>
          {/* Cam On Button */}
          <button
            onClick={async () => {
              setIsLoading(true);
              try {
                await handleStart();
              } finally {
                setIsLoading(false);
              }
            }}
            disabled={isRunning || isLoading || isPreviewing}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
          >
            {isLoading ? "Cam On" : "Cam On"}
          </button>
          {/* Cam Off Button */}
          <button onClick={handleStop} disabled={(!isRunning && !isPreviewing) || isLoading} className="px-4 py-2 bg-red-500 text-white rounded disabled:bg-gray-300">
            {isLoading ? "Cam Off" : "Cam Off"}
          </button>
        </div>

        {/* Control Settings */}
        <div className="space-y-3 p-4 bg-gray-50 rounded">
          {/* Sensitivity */}
          <div>
            <label className="block text-sm mb-1">Sensitivity ({settings.sensitivity})</label>
            <input type="range" min="5" max="200" value={settings.sensitivity} onChange={(e) => setSettings((prev) => ({ ...prev, sensitivity: Number(e.target.value) }))} className="w-full" />
          </div>

          {/* Threshold */}
          <div>
            <label className="block text-sm mb-1">Threshold ({settings.threshold}%)</label>
            <input type="range" min="0.1" max="10.0" step="0.1" value={settings.threshold} onChange={(e) => setSettings((prev) => ({ ...prev, threshold: Number(e.target.value) }))} className="w-full" />
          </div>

          {/* Cooldown */}
          <div>
            <label className="block text-sm mb-1">Cooldown ({settings.cooldown}ms)</label>
            <input type="range" min="100" max="25000" step="100" value={settings.cooldown} onChange={(e) => setSettings((prev) => ({ ...prev, cooldown: Number(e.target.value) }))} className="w-full" />
          </div>

          {/* Frames to Skip */}
          <div>
            <label className="block text-sm mb-1">Frames to Skip ({settings.framesToSkip})</label>
            <input type="range" min="1" max="240" value={settings.framesToSkip} onChange={(e) => setSettings((prev) => ({ ...prev, framesToSkip: Number(e.target.value) }))} className="w-full" />
          </div>

          {/* Save / Load Settings */}
          <div>Camera Settings:</div>
          <div className="flex gap-2 pt-4">
            <button onClick={() => setShowSaveDialog(true)} className="px-4 py-2 bg-green-500 text-white rounded">
              Save
            </button>

            <select
              onChange={(e) => {
                if (e.target.value) {
                  const selected = savedSettings.find((s) => s.id === e.target.value);
                  if (selected) handleLoadSettings(selected);
                }
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

          {/* 
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={settings.enableAudio} onChange={(e) => setSettings((prev) => ({ ...prev, enableAudio: e.target.checked }))} id="enableAudio" />
            <label htmlFor="enableAudio" className="text-sm">
              Enable Audio
            </label>
          </div>


          <div className="flex items-center gap-2">
            <input type="checkbox" checked={settings.enableDebugView} onChange={(e) => setSettings((prev) => ({ ...prev, enableDebugView: e.target.checked }))} id="enableDebugView" />
            <label htmlFor="enableDebugView" className="text-sm">
              Show Debug View
            </label>
          </div>
*/}

          {/* Logging */}
          <div className="pt-2 border-t">
            <div className="text-sm">Motion Events: {motionEvents}</div>
            {lastChangePercent !== null && <div className="text-sm">Last Change: {lastChangePercent.toFixed(1)}%</div>}
          </div>
        </div>

        {/* Dialog */}
        {showSaveDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-4 rounded-lg space-y-4">
              <h3 className="font-bold">Save Settings</h3>
              <input type="text" value={newSettingsName} onChange={(e) => setNewSettingsName(e.target.value)} placeholder="Enter settings name" className="px-4 py-2 border rounded w-full" />
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
};
