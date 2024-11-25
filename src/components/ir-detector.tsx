// src/components/IRDetector.tsx
import React, { useEffect, useState } from "react";
import axios from "axios";

interface IRDetector {
  id: string | null;
  time: string | null;
}

const IRDetector: React.FC = () => {
  const [carData, setCarData] = useState<CarData>({ id: null, time: null });

  // Function to fetch data from the server
  const fetchCarData = async () => {
    try {
      const response = await axios.get("/api/ir/current_car");
      setCarData(response.data);
    } catch (error) {
      console.error("Error fetching car data:", error);
    }
  };

  // Fetch car data every second
  useEffect(() => {
    const intervalId = setInterval(fetchCarData, 1000); // 1-second interval

    return () => {
      clearInterval(intervalId); // Clean up interval on component unmount
    };
  }, []);

  return (
    <div style={{ textAlign: "center" }}>
      <h1>Car Detector</h1>
      <h2>Car ID: {carData.id ? carData.id : "None"}</h2>
      <p>Detected at: {carData.time ? carData.time : "None"}</p>
    </div>
  );
};

export default IRDetector;
