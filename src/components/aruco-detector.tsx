import React, { useEffect, useRef, useState } from "react";

const ArucoDetector = () => {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const [markerId, setMarkerId] = useState(null); // State to store the detected marker ID


  const markerIdRef = useRef(markerId);
  // Sync with the ref whenever it changes
  useEffect(() => {
    markerIdRef.current = markerId;
  }, [markerId]);



  useEffect(() => {
    const loadScript = (src, onLoad) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = onLoad;
      document.body.appendChild(script);
    };

    // Load `cv.js` first
    loadScript("/js/cv.js", () => {
      console.log("cv.js loaded successfully");

      // Load `aruco.js` next
      loadScript("/js/aruco.js", () => {
        console.log("aruco.js loaded successfully");
        initializeDetector();
      });
    });
  }, []);

  const initializeDetector = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!window.AR) {
      console.error("AR is not defined");
      return;
    }

    const context = canvas.getContext("2d", { willReadFrequently: true });
    const detector = new window.AR.Detector();

    const processFrame = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const markers = detector.detect(imageData);

        drawCorners(context, markers);
        drawIds(context, markers);
      }
      requestAnimationFrame(processFrame);
    };

    processFrame();
  };

  const drawCorners = (context, markers) => {
    context.lineWidth = 3;
    markers.forEach((marker) => {
      const corners = marker.corners;
      context.strokeStyle = "red";
      context.beginPath();
      corners.forEach((corner, index) => {
        context.moveTo(corner.x, corner.y);
        const nextCorner = corners[(index + 1) % corners.length];
        context.lineTo(nextCorner.x, nextCorner.y);
      });
      context.stroke();
      context.closePath();
    });
  };

  const delayRef = useRef(false); // To track if delay is active

  const drawIds = async (context, markers) => {
    if (delayRef.current) return; // Skip if delay is active
  
    const detectedIds = []; // Array to store detected marker IDs
  
    for (const marker of markers) {
      const corners = marker.corners;
      const x = Math.min(...corners.map((corner) => corner.x));
      const y = Math.min(...corners.map((corner) => corner.y));
  
      if (!detectedIds.includes(marker.id)) {
        detectedIds.push(marker.id); // Add marker ID to the array
      }
  
      // Draw the ID on the canvas
      context.fillText(marker.id, x, y);
    }
  
    if (detectedIds.length > 0) {
      console.log("Detected Marker IDs:", detectedIds); // Log all detected IDs
      delayRef.current = true; // Activate delay to prevent further detections
  
      // Introduce a delay
      //await new Promise((resolve) => setTimeout(resolve, 5000));
  
      delayRef.current = false; // Deactivate delay
    }
  };
  

  
  const startVideo = async () => {
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { exact: "environment" }, // Request rear-facing camera
        },
      });
  
      const video = videoRef.current;
      video.srcObject = videoStream;
  
      // Wait for the video to load metadata before playing
      video.onloadedmetadata = () => {
        video.play().catch((error) => {
          console.error("Error starting video playback:", error);
        });
      };
    } catch (error) {
      console.error("Error accessing the webcam:", error);
  
      // If the rear-facing camera is not available, fallback to default
      if (error.name === "OverconstrainedError") {
        console.warn("Rear-facing camera not available. Using default camera.");
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        const video = videoRef.current;
        video.srcObject = fallbackStream;
        video.onloadedmetadata = () => {
          video.play().catch((fallbackError) => {
            console.error("Error starting fallback video playback:", fallbackError);
          });
        };
      }
    }
  };
 
  useEffect(() => {
    startVideo();
    return () => {
      const videoStream = videoRef.current?.srcObject;
      if (videoStream) {
        const tracks = videoStream.getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div style={{ fontFamily: "monospace" }}>
      <center>
        <div style={{ margin: "10px" }}>
          <strong>- = Augmented Reality Marker Detector = -</strong>
        </div>
        <video ref={videoRef} id="video" width="320" height="240" style={{ display: "none" }}></video>
        <canvas ref={canvasRef} id="canvas" width="320" height="240" style={{ display: "block" }}></canvas>
        {/* Display the detected marker ID */}
        <div style={{ marginTop: "20px" }}>
          <strong>Detected Marker ID:</strong> {markerId !== null ? markerId : "No marker detected"}
        </div>
      </center>
    </div>
  );
};

export default ArucoDetector;
