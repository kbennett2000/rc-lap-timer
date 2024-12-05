// src/components/LEDControl.tsx

import React, { useState, useEffect } from "react";
import { LEDDeviceService } from "../services/ledDevice";

export function LEDControl() {
  const [status, setStatus] = useState<"searching" | "ready" | "error">("searching");
  const [ledDevice] = useState(() => new LEDDeviceService());
  const [rgbValues, setRgbValues] = useState({ r: 0, g: 0, b: 0 });
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  // Test connection on mount
  useEffect(() => {
    const connect = async () => {
      try {
        // Try to set black color as a connection test
        await ledDevice.setColor(0, 0, 0);
        setStatus("ready");
      } catch (error) {
        console.error("Failed to connect:", error);
        setStatus("error");
      }
    };
    connect();
  }, [ledDevice]);

  const handleColorChange = async () => {
    try {
      await ledDevice.setColor(rgbValues.r, rgbValues.g, rgbValues.b);
    } catch (error) {
      setStatus("error");
    }
  };

  if (status === "searching") {
    return <div>Searching for LED device...</div>;
  }

  if (status === "error") {
    return (
      <div>
        <p>Cannot find LED device. Make sure it's connected to the network.</p>
        <button onClick={() => setStatus("searching")}>Try Again</button>
      </div>
    );
  }

  return (
    <div>
      <h2>LED Control</h2>

      {/* Color Controls */}
      <div>
        <h3>Color</h3>
        <div>
          <label>
            Red:
            <input
              type="range"
              min="0"
              max="255"
              value={rgbValues.r}
              onChange={(e) => {
                setRgbValues((prev) => ({ ...prev, r: Number(e.target.value) }));
                handleColorChange();
              }}
            />
          </label>
        </div>
        <div>
          <label>
            Green:
            <input
              type="range"
              min="0"
              max="255"
              value={rgbValues.g}
              onChange={(e) => {
                setRgbValues((prev) => ({ ...prev, g: Number(e.target.value) }));
                handleColorChange();
              }}
            />
          </label>
        </div>
        <div>
          <label>
            Blue:
            <input
              type="range"
              min="0"
              max="255"
              value={rgbValues.b}
              onChange={(e) => {
                setRgbValues((prev) => ({ ...prev, b: Number(e.target.value) }));
                handleColorChange();
              }}
            />
          </label>
        </div>
      </div>

      {/* Message Controls */}
      <div>
        <h3>Display Message</h3>
        <div>
          <input type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input type="text" placeholder="Message" value={message} onChange={(e) => setMessage(e.target.value)} />
          <button onClick={() => ledDevice.displayMessage(title, message)}>Send</button>
        </div>
      </div>

      {/* Pattern Controls */}
      <div>
        <h3>Patterns</h3>
        <button onClick={() => ledDevice.runPattern("police")}>Police</button>
        <button onClick={() => ledDevice.runPattern("rainbow")}>Rainbow</button>
        <button onClick={() => ledDevice.runPattern("strobe")}>Strobe</button>
      </div>
    </div>
  );
}
