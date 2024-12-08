import React, { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";

interface CarDetection {
  id: string;
  time: string;
}

interface CooldownMap {
  [carId: string]: number;
}

interface IRDetectorProps {
  allowedCarNumbers: string[];
  onCarDetected?: (carId: string, timestamp: string) => void;
}

const IRDetector: React.FC<IRDetectorProps> = ({ allowedCarNumbers, onCarDetected }) => {
  const [lastDetectedCars, setLastDetectedCars] = useState<CarDetection[]>([]);
  const [carCooldowns, setCarCooldowns] = useState<CooldownMap>({});
  const [cooldownPeriod] = useState(5000);
  const cooldownRef = useRef<CooldownMap>({});
  const previousCarsRef = useRef<Set<string>>(new Set());

  const isCarAllowed = useCallback(
    (carId: string): boolean => {
      //console.log(`**isCarAllowed - ${carId}`);
      return allowedCarNumbers.includes(carId);
    },
    [allowedCarNumbers]
  );

  const startCooldown = useCallback(
    (carId: string) => {
      //console.log(`**startCooldown`);
      const newCooldowns = {
        ...cooldownRef.current,
        [carId]: Date.now() + cooldownPeriod,
      };
      cooldownRef.current = newCooldowns;
      setCarCooldowns(newCooldowns);
    },
    [cooldownPeriod]
  );

  const processNewDetections = useCallback(    
    (cars: CarDetection[]) => {
      //console.log(`**processNewDetections`);
      const currentCarIds = new Set(cars.map((car) => car.id));
      const previousCarIds = previousCarsRef.current;

      //console.log(`1`);
      // Find newly detected cars
      cars.forEach((car) => {
        //console.log(`2 - ${car.id}`);
        if (!previousCarIds.has(car.id)) {
          //console.log(`3`);
          const cooldownEndTime = cooldownRef.current[car.id];
          if (!cooldownEndTime || Date.now() >= cooldownEndTime) {
            //console.log(`4`);
            if (isCarAllowed(car.id)) {            
              //console.log(`5`);
              onCarDetected?.(car.id, car.time);
              startCooldown(car.id);
            }
          }
        }
      });

      previousCarsRef.current = currentCarIds;
      setLastDetectedCars(cars);
    },
    [isCarAllowed, onCarDetected, startCooldown]
  );

  const fetchCarData = useCallback(async () => {
    //console.log(`**fetchCarData`);

    try {
      const response = await axios.get("/api/ir/current_cars");
      //console.log(`fetchCarData - response.data: ${response.data}`);
      processNewDetections(response.data);
    } catch (error) {
      console.error("Error fetching car data:", error);
    }
  }, [processNewDetections]);

  useEffect(() => {
    const intervalId = setInterval(fetchCarData, 50);
    return () => clearInterval(intervalId);
  }, [fetchCarData]);

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

  return (
    <div className="text-center p-4 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-4">Car Detector</h1>

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

      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-xl mb-2 text-gray-800">Last Detected Cars:</h2>
        {lastDetectedCars.map((car) => (
          <div key={car.id} className="mb-2">
            Car {car.id}
            {!isCarAllowed(car.id) && <span className="ml-2 text-sm text-red-500">(not monitored)</span>}
            <p className="text-gray-600">Detected at: {car.time}</p>
          </div>
        ))}
        {lastDetectedCars.length === 0 && <p className="text-gray-600">No cars detected</p>}
      </div>

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