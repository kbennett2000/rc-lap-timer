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
  cooldownPeriod: number; // milliseconds
  onCarDetected?: (carId: string, timestamp: string) => void;
}

const IRDetector: React.FC<IRDetectorProps> = ({ cooldownPeriod, onCarDetected }) => {
  const [lastDetectedCar, setLastDetectedCar] = useState<CarData>({ id: null, time: null });
  const [carCooldowns, setCarCooldowns] = useState<CooldownMap>({});

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

      // Check if this is a new detection (different car or different time)
      const isNewDetection = newCarData.id !== lastDetectedCar.id || newCarData.time !== lastDetectedCar.time;

      if (!isNewDetection) return;

      // Check if this specific car is in cooldown
      if (isCarInCooldown(newCarData.id)) return;

      // Update last detected car
      setLastDetectedCar(newCarData);

      // Start cooldown for this specific car
      startCooldown(newCarData.id);

      // Notify parent component
      if (onCarDetected) {
        onCarDetected(newCarData.id, newCarData.time);
      }
    },
    [lastDetectedCar, isCarInCooldown, startCooldown, onCarDetected]
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
    }, 1000); // Clean up every second

    return () => clearInterval(cleanupInterval);
  }, []);

  // Fetch car data frequently
  useEffect(() => {
    const intervalId = setInterval(fetchCarData, 100); // Poll more frequently
    return () => clearInterval(intervalId);
  }, [fetchCarData]);

  return (
    <div className="text-center p-4">
      <h1 className="text-2xl font-bold mb-4">Car Detector</h1>
      <h2 className="text-xl mb-2">Last Detected: {lastDetectedCar.id ? `Car ${lastDetectedCar.id}` : "None"}</h2>
      <p>Detected at: {lastDetectedCar.time ? lastDetectedCar.time : "None"}</p>
      <div className="mt-4">
        <h3 className="text-lg font-semibold mb-2">Cars in Cooldown:</h3>
        <ul className="list-none">
          {Object.entries(carCooldowns).map(([carId, endTime]) => {
            const remainingTime = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
            if (remainingTime <= 0) return null;
            return (
              <li key={carId} className="mb-1">
                Car {carId}: {remainingTime}s remaining
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default IRDetector;
