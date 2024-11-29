//src/components/ir-detector.tsx

import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";

interface CarData {
  id: string | null;
  time: string | null;
}

interface CooldownMap {
  [carId: string]: number;
}

interface IRDetectorProps {
  allowedCarNumbers: string[]; // Array of allowed car numbers
  onCarDetected?: (carId: string, timestamp: string) => void;
}

const IRDetector: React.FC<IRDetectorProps> = ({ allowedCarNumbers, onCarDetected }) => {
  const [lastDetectedCar, setLastDetectedCar] = useState<CarData>({ id: null, time: null });
  const [carCooldowns, setCarCooldowns] = useState<CooldownMap>({});
  const [cooldownPeriod, setCooldownPeriod] = useState(5000);

  // Check if a car number is allowed
  const isCarAllowed = useCallback(
    (carId: string): boolean => {
      return allowedCarNumbers.includes(carId);
    },
    [allowedCarNumbers]
  );

  // Check if a car is in cooldown
  const isCarInCooldown = useCallback(
    (carId: string): boolean => {
      const cooldownEndTime = carCooldowns[carId];
      if (!cooldownEndTime) return false;
      return Date.now() < cooldownEndTime;
    },
    [carCooldowns]
  );

  // Start cooldown for a car
  const startCooldown = useCallback(
    (carId: string) => {
      setCarCooldowns((prev) => ({
        ...prev,
        [carId]: Date.now() + cooldownPeriod,
      }));
    },
    [cooldownPeriod]
  );

  // Process new car detection
  const processCarDetection = useCallback(
    (newCarData: CarData) => {
      if (!newCarData.id || !newCarData.time) return;

      // Always update last detected car regardless of whether it's allowed
      const isNewDetection = newCarData.id !== lastDetectedCar.id || newCarData.time !== lastDetectedCar.time;

      if (!isNewDetection) return;

      // Check if this specific car is in cooldown
      if (isCarInCooldown(newCarData.id)) return;

      // Update last detected car (we show all detections in the UI)
      setLastDetectedCar(newCarData);

      // Start cooldown for this specific car
      startCooldown(newCarData.id);

      // Only notify parent if the car is in the allowed list
      if (onCarDetected && isCarAllowed(newCarData.id)) {
        onCarDetected(newCarData.id, newCarData.time);
      }
    },
    [lastDetectedCar, isCarInCooldown, startCooldown, onCarDetected, isCarAllowed]
  );

  // Function to fetch data from the server
  const fetchCarData = useCallback(async () => {
    try {
      const response = await axios.get("/api/ir/current_car");
      const newCarData: CarData = response.data;

      if (newCarData.id && newCarData.time) {
        processCarDetection(newCarData);
      }
    } catch (error) {
      console.error("Error fetching car data:", error);
    }
  }, [processCarDetection]);

  // Clean up expired cooldowns periodically
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setCarCooldowns((prev) => {
        const updated = { ...prev };
        let hasChanges = false;
        Object.entries(updated).forEach(([carId, endTime]) => {
          if (endTime < now) {
            delete updated[carId];
            hasChanges = true;
          }
        });
        return hasChanges ? updated : prev;
      });
    }, 1000);

    return () => clearInterval(cleanupInterval);
  }, []);

  // TODO: update interval?
  // Fetch car data frequently
  useEffect(() => {
    const intervalId = setInterval(fetchCarData, 100);
    return () => clearInterval(intervalId);
  }, [fetchCarData]);

  // Handle cooldown period change
  const handleCooldownChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(event.target.value) * 1000;
    setCooldownPeriod(newValue);
  };

  return (
    <div className="text-center p-4 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-4">Car Detector</h1>

      {/* Allowed Cars Display */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-2 text-gray-800">Monitoring Cars:</h3>
        <div className="flex flex-wrap gap-2 justify-center">
          {allowedCarNumbers.map((carId) => (
            <span key={carId} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
              Car {carId}
            </span>
          ))}
        </div>
      </div>

      {/* Cooldown Period Control */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <label className="block text-sm font-medium text-gray-700 mb-2">Cooldown Period: {cooldownPeriod / 1000} seconds</label>
        <input type="range" min="1" max="30" value={cooldownPeriod / 1000} onChange={handleCooldownChange} className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer" />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>1s</span>
          <span>30s</span>
        </div>
      </div>

      {/* Last Detection Display */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-xl mb-2 text-gray-800">
          Last Detected: {lastDetectedCar.id ? `Car ${lastDetectedCar.id}` : "None"}
          {lastDetectedCar.id && !isCarAllowed(lastDetectedCar.id) && <span className="ml-2 text-sm text-red-500">(not monitored)</span>}
        </h2>
        <p className="text-gray-600">Detected at: {lastDetectedCar.time ? lastDetectedCar.time : "None"}</p>
      </div>

      {/* Cooldown Status */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-2 text-gray-800">Cars in Cooldown:</h3>
        <ul className="list-none">
          {Object.entries(carCooldowns).map(([carId, endTime]) => {
            const remainingTime = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
            if (remainingTime <= 0) return null;
            return (
              <li key={carId} className="mb-1 text-gray-700">
                Car {carId}
                {!isCarAllowed(carId) && " (not monitored)"}: {remainingTime}s remaining
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default IRDetector;
