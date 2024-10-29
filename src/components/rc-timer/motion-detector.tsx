import React, { useEffect, useRef, useState, useCallback } from "react";

interface MotionDetectorProps {
  onMotionDetected?: (changePercent: number) => void;
  className?: string;
}

interface DetectorSettings {
  sensitivity: number;
  threshold: number;
  cooldown: number;
  enableAudio: boolean;
  enableDebugView: boolean;
}

const DEFAULT_SETTINGS: DetectorSettings = {
  sensitivity: 100,
  threshold: 5.0,
  cooldown: 5000,
  enableAudio: true,
  enableDebugView: true,
};

export const MotionDetector: React.FC<MotionDetectorProps> = ({ onMotionDetected, className = "" }) => {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const previousFrameRef = useRef<ImageData | null>(null);
  const lastMotionTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number>();

  // State
  const [settings, setSettings] = useState<DetectorSettings>(DEFAULT_SETTINGS);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string>("");
  const [motionEvents, setMotionEvents] = useState(0);
  const [lastChangePercent, setLastChangePercent] = useState<number | null>(null);
  const [isStoppingRef] = useState({ current: false }); // Use ref-like state for immediate access in rAF
  const [isLoading, setIsLoading] = useState(false);

  const isActiveRef = useRef(true); // Use a ref for immediate access in rAF loop

  // Add this helper function near the top of the component
  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined; // Clear the ref
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
      throw err; // Re-throw to handle in handleStart
    }
  }, []);

  // Motion detection
  const detectMotion = useCallback(() => {
    // Immediate check of ref before doing anything
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

    if (!ctx || !debugCtx) return;

    // Check again before heavy computation
    if (!isActiveRef.current) {
      return;
    }

    ctx.drawImage(video, 0, 0);
    const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (settings.enableDebugView) {
      debugCtx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
    }

    if (previousFrameRef.current && isActiveRef.current) {
      // Add ref check here
      let changedPixels = 0;
      const debugFrame = settings.enableDebugView ? debugCtx.createImageData(canvas.width, canvas.height) : null;

      // Only process frame if still active
      if (isActiveRef.current) {
        for (let i = 0; i < currentFrame.data.length; i += 4) {
          const rDiff = Math.abs(currentFrame.data[i] - previousFrameRef.current.data[i]);
          const gDiff = Math.abs(currentFrame.data[i + 1] - previousFrameRef.current.data[i + 1]);
          const bDiff = Math.abs(currentFrame.data[i + 2] - previousFrameRef.current.data[i + 2]);

          if (rDiff > settings.sensitivity || gDiff > settings.sensitivity || bDiff > settings.sensitivity) {
            changedPixels++;
            if (debugFrame) {
              debugFrame.data[i] = 255;
              debugFrame.data[i + 1] = 0;
              debugFrame.data[i + 2] = 0;
              debugFrame.data[i + 3] = 128;
            }
          }
        }

        if (settings.enableDebugView && debugFrame) {
          debugCtx.putImageData(debugFrame, 0, 0);
        }

        const frameSize = currentFrame.width * currentFrame.height;
        const changePercent = (changedPixels / frameSize) * 100;
        setLastChangePercent(changePercent);

        // Only trigger motion detection if still active
        if (isActiveRef.current) {
          const now = Date.now();
          if (changePercent > settings.threshold && now - lastMotionTimeRef.current > settings.cooldown) {
            if (isActiveRef.current) {
              // Final check before triggering
              playBeep();
              setMotionEvents((prev) => prev + 1);
              onMotionDetected?.(changePercent);
              lastMotionTimeRef.current = now;

              // Only log if still active
              if (isActiveRef.current) {
                // TODO: uncomment for logging
                /*
                fetch("/api/log", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    event: "*** MOTION DETECTED ***",
                    changePercent: changePercent.toFixed(1),
                    threshold: settings.threshold,
                    cooldown: settings.cooldown,
                    timeSinceLastMotion: now - lastMotionTimeRef.current,
                    settings: settings,
                    detectionState: {
                      isActive: isActiveRef.current,
                      timestamp: new Date().toISOString(),
                    },
                  }),                  
                }).catch(console.error);
*/
              }
            }
          }
        }
      }
    }

    previousFrameRef.current = currentFrame;

    // Only schedule next frame if still active
    if (isActiveRef.current) {
      animationFrameRef.current = requestAnimationFrame(detectMotion);
    }
  }, [settings, playBeep, onMotionDetected]);

  // Modify the start/stop handlers
  const handleStop = useCallback(() => {
    // Immediately set active to false
    isActiveRef.current = false;

    // Cancel any pending animation frame immediately
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }

    // Stop all tracks immediately
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    // Clear other refs
    previousFrameRef.current = null;
    lastMotionTimeRef.current = 0;

    // Update state
    setIsRunning(false);

    // Log after cleanup
    // TODO: uncomment for logging
    /*
    fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "motion_detector_stopped",
        timestamp: new Date().toISOString(),
      }),
    }).catch(console.error);
    */
  }, []);

  const handleStart = useCallback(async () => {
    try {
      setError("");
      isActiveRef.current = true;

      // First get camera working
      await setupCamera();

      // Then initialize audio
      await initAudio();

      // Then start motion detection
      setIsRunning(true);
      detectMotion();
    } catch (err) {
      setError("Failed to start: " + (err instanceof Error ? err.message : String(err)));
      isActiveRef.current = false;
      handleStop(); // Clean up if start fails
    }
  }, [setupCamera, initAudio, detectMotion]);

  // Single useEffect for video setup
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

  // Cleanup effect
  useEffect(() => {
    return () => {
      handleStop();
    };
  }, []);
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Video container */}
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video ref={videoRef} autoPlay playsInline className="w-full" />
        <canvas ref={debugCanvasRef} className={`absolute top-0 left-0 w-full h-full ${settings.enableDebugView ? "opacity-50" : "hidden"}`} />
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Error message */}
      {error && <div className="text-red-500 bg-red-50 p-2 rounded">{error}</div>}

      {/* Controls */}
      <div className="space-y-4">
        {/* Basic controls */}
        <div className="flex gap-2">
          <button
            onClick={async () => {
              setIsLoading(true);
              try {
                await handleStart();
              } finally {
                setIsLoading(false);
              }
            }}
            disabled={isRunning || isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
          >
            {isLoading ? "Starting..." : "Start"}
          </button>
          <button onClick={handleStop} disabled={!isRunning || isLoading} className="px-4 py-2 bg-red-500 text-white rounded disabled:bg-gray-300">
            {isLoading ? "Stopping..." : "Stop"}
          </button>
        </div>

        {/* Settings */}
        <div className="space-y-3 p-4 bg-gray-50 rounded">
          <div>
            <label className="block text-sm mb-1">Sensitivity ({settings.sensitivity})</label>
            <input type="range" min="5" max="200" value={settings.sensitivity} onChange={(e) => setSettings((prev) => ({ ...prev, sensitivity: Number(e.target.value) }))} className="w-full" />
          </div>

          <div>
            <label className="block text-sm mb-1">Threshold ({settings.threshold}%)</label>
            <input type="range" min="0.1" max="10.0" step="0.1" value={settings.threshold} onChange={(e) => setSettings((prev) => ({ ...prev, threshold: Number(e.target.value) }))} className="w-full" />
          </div>

          <div>
            <label className="block text-sm mb-1">Cooldown ({settings.cooldown}ms)</label>
            <input type="range" min="100" max="10000" step="100" value={settings.cooldown} onChange={(e) => setSettings((prev) => ({ ...prev, cooldown: Number(e.target.value) }))} className="w-full" />
          </div>

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

          <div className="pt-2 border-t">
            <div className="text-sm">Motion Events: {motionEvents}</div>
            {lastChangePercent !== null && <div className="text-sm">Last Change: {lastChangePercent.toFixed(1)}%</div>}
          </div>
        </div>
      </div>
    </div>
  );
};
