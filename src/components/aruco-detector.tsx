import React, { useEffect, useRef } from "react";
import PropTypes from "prop-types";

const ArucoDetector = ({ isScanning, onMarkersDetected }) => {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const delayRef = useRef(false);
  const scanningRef = useRef(isScanning); // Track scanning state using a ref

  useEffect(() => {
    scanningRef.current = isScanning; // Update ref whenever isScanning changes
  }, [isScanning]);

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
      if (!scanningRef.current || delayRef.current) {
        // Skip processing frames if scanning is disabled or delay is active
        requestAnimationFrame(processFrame);
        return;
      }

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const markers = detector.detect(imageData);

        drawIds(context, markers);
      }

      requestAnimationFrame(processFrame);
    };

    processFrame();
  };

  const drawIds = async (context, markers) => {
    // if (delayRef.current) return;

    const detectedIds = markers.map((marker) => marker.id); // Collect all marker IDs

    onMarkersDetected(detectedIds); // Pass detected IDs to parent

    /*
    if (detectedIds.length > 0) {
      delayRef.current = true;

      // Introduce a delay
      await new Promise((resolve) => setTimeout(resolve, 50));

      delayRef.current = false;
    }
    */

    /*
    markers.forEach((marker) => {
      const corners = marker.corners;
      const x = Math.min(...corners.map((corner) => corner.x));
      const y = Math.min(...corners.map((corner) => corner.y));

      // Draw the ID on the canvas
      context.fillText(marker.id, x, y);
    });
    */

  };

  const startVideo = async () => {
    if (!videoRef.current) {
      console.error("Video element is not ready yet.");
      return;
    }

    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { exact: "environment" },
        },
      });

      videoRef.current.srcObject = videoStream;

      videoRef.current.onloadedmetadata = () => {
        videoRef.current.play().catch((error) => console.error("Error playing video:", error));
      };
    } catch (error) {
      console.error("Error accessing the webcam:", error);

      if (error.name === "OverconstrainedError") {
        console.warn("Rear camera not available. Using default camera.");

        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });

          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current.play().catch((fallbackError) => console.error("Error playing fallback video:", fallbackError));
            };
          }
        } catch (fallbackError) {
          console.error("Error accessing fallback camera:", fallbackError);
        }
      }
    }
  };

  useEffect(() => {
    if (videoRef.current) {
      startVideo();
    }
  }, [videoRef]);

  return (
    <div style={{ fontFamily: "monospace" }}>
      <center>
        <div style={{ margin: "10px" }}>
          <strong>- = Augmented Reality Marker Detector = -</strong>
        </div>
        <video ref={videoRef} id="video" width="320" height="240" style={{ display: "none" }}></video>
        <canvas ref={canvasRef} id="canvas" width="320" height="240" style={{ display: "block" }}></canvas>
      </center>
    </div>
  );
};

ArucoDetector.propTypes = {
  isScanning: PropTypes.bool.isRequired, // Controls whether scanning is active
  onMarkersDetected: PropTypes.func.isRequired, // Callback for detected markers
};

export default ArucoDetector;
