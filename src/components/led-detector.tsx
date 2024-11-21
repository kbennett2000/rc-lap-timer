import React, { useRef, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const LEDDetector: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const processingRef = useRef(false);
  const lastStateRef = useRef<'rising' | 'falling' | 'stable'>('stable');
  const peakTimesRef = useRef<number[]>([]);
  const brightnessHistoryRef = useRef<number[]>([]);

  const [stats, setStats] = useState({
    frequency: null as number | null,
    currentBrightness: 0,
    minBrightness: 0,
    maxBrightness: 0,
    peaks: 0,
    fps: 0
  });

  // Setup camera with low resolution
  useEffect(() => {
    const setup = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: "environment",
            width: { ideal: 320 },    // Low resolution
            height: { ideal: 240 }
          }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (canvasRef.current && videoRef.current) {
              // Match canvas to video size
              canvasRef.current.width = videoRef.current.videoWidth;
              canvasRef.current.height = videoRef.current.videoHeight;
              ctxRef.current = canvasRef.current.getContext('2d', { 
                willReadFrequently: true,
                alpha: false  // Optimization
              });
            }
          };
        }
      } catch (err) {
        console.error("Camera error:", err);
      }
    };

    setup();
  }, []);

  const processFrame = () => {
    if (!processingRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;

    if (!video || !canvas || !ctx) {
      requestAnimationFrame(processFrame);
      return;
    }

    // Draw full frame
    ctx.drawImage(video, 0, 0);
    
    // Get full frame data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Calculate average brightness
    let totalBrightness = 0;
    for (let i = 0; i < data.length; i += 16) {  // Sample every 4th pixel (4 channels per pixel)
      totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
    }
    const avgBrightness = totalBrightness / (data.length / 16);

    // Add to history
    brightnessHistoryRef.current.push(avgBrightness);
    if (brightnessHistoryRef.current.length > 20) {  // Increased from 10
        brightnessHistoryRef.current.shift();
    }

    const movingAvg = brightnessHistoryRef.current.reduce((a, b) => a + b) / 
                     brightnessHistoryRef.current.length;

    // More sensitive threshold for slower changes
    const currentSlope = avgBrightness - movingAvg;
    const threshold = 1;  // Reduced from 2 for more sensitivity

    if (Math.abs(currentSlope) > threshold) {
        const newState = currentSlope > 0 ? 'rising' : 'falling';
        
        if (lastStateRef.current === 'rising' && newState === 'falling') {
            const now = performance.now();
            peakTimesRef.current.push(now);
            
            // Keep longer history for slower frequencies
            peakTimesRef.current = peakTimesRef.current.filter(t => now - t < 2000);  // Increased from 1000

        // Calculate frequency if we have enough peaks
        if (peakTimesRef.current.length >= 4) {
          const intervals = [];
          for (let i = 1; i < peakTimesRef.current.length; i++) {
            intervals.push(peakTimesRef.current[i] - peakTimesRef.current[i - 1]);
          }

          const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
          const freq = 1000 / avgInterval;  // Convert to Hz

          // Find nearest expected frequency
          // TODO: expected frequencies
          const expectedFreqs = [2, 4, 6, 8, 10, 12];
          const matchedFreq = expectedFreqs.reduce((prev, curr) => 
            Math.abs(curr - freq) < Math.abs(prev - freq) ? curr : prev
          );

          // Check consistency
          const variance = intervals.reduce((sum, interval) => 
            sum + Math.pow(interval - avgInterval, 2), 0
          ) / intervals.length;
          
          // Only update if variance is low (consistent intervals)
          if (Math.sqrt(variance) < avgInterval * 0.3) {
            setStats(prev => ({
              ...prev,
              frequency: matchedFreq,
              peaks: peakTimesRef.current.length
            }));
          }
        }
      }
      
      lastStateRef.current = newState;
    }

    // Update stats
    setStats(prev => ({
      ...prev,
      currentBrightness: avgBrightness,
      minBrightness: Math.min(prev.minBrightness || avgBrightness, avgBrightness),
      maxBrightness: Math.max(prev.maxBrightness || avgBrightness, avgBrightness)
    }));

    requestAnimationFrame(processFrame);
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>LED Frequency Detector</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="relative">
            <video 
              ref={videoRef} 
              className="w-full rounded-lg"
              autoPlay 
              playsInline 
              muted
            />
            <canvas 
              ref={canvasRef} 
              className="absolute top-0 left-0 w-full h-full opacity-50"
            />
          </div>

          <button 
            className="px-4 py-2 bg-blue-500 text-white rounded-lg w-full"
            onClick={() => {
              if (processingRef.current) {
                processingRef.current = false;
              } else {
                brightnessHistoryRef.current = [];
                peakTimesRef.current = [];
                lastStateRef.current = 'stable';
                processingRef.current = true;
                requestAnimationFrame(processFrame);
              }
            }}
          >
            {processingRef.current ? "Stop" : "Start"} Detection
          </button>

          <div className="p-4 bg-gray-100 rounded-lg space-y-2">
            <div className="text-xl font-bold">
              {stats.frequency ? `${stats.frequency} Hz` : "No frequency detected"}
            </div>
            <div>Peaks: {stats.peaks}</div>
            <div>Brightness: {Math.round(stats.currentBrightness)}</div>
            <div>Range: {Math.round(stats.minBrightness)} - {Math.round(stats.maxBrightness)}</div>
            <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
              <div 
                className="h-full bg-yellow-500 transition-all duration-100"
                style={{ 
                  width: `${((stats.currentBrightness - stats.minBrightness) / 
                          (stats.maxBrightness - stats.minBrightness)) * 100}%` 
                }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LEDDetector;