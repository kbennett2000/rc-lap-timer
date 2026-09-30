"use client";

import React, { useState, useEffect } from "react";
import { Car as CarIcon, UserCog, Flag } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { Driver, Location } from "@/types/rc-timer";
import DriverCarManager from "@/components/driver-car-manager";
import { RacingSession } from "../racing-session";
import { RaceHistory } from "../racing-session/race-history";
import PracticeControl from "./practice-control";
import { logger } from "@/lib/logger";

export default function LapTimer() {
  const [activeTab, setActiveTab] = useState("practice");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // Only the Manager tab uses these lists, so load them whenever it is opened.
  const loadManagerData = async () => {
    try {
      const response = await fetch("/api/data");
      if (!response.ok) throw new Error("Failed to load data");

      const data = await response.json();
      setDrivers(data.drivers);
      setLocations(data.locations);
    } catch (error) {
      logger.error("Error loading data:", error);
    }
  };

  useEffect(() => {
    if (activeTab === "drivercarmanager") {
      loadManagerData();
    }
  }, [activeTab]);

  // ****************************************
  // return
  // ****************************************
  return (
    <div className="min-h-screen bg-white">
      {/* Main Content Area */}
      <div className="pt-16 pb-20">
        <Tabs defaultValue="practice" className="h-full" value={activeTab} onValueChange={setActiveTab}>
          {/* Practice Tab: always mounted (only hidden when inactive) so a running session survives tab switches */}
          <TabsContent value="practice" forceMount className="px-4 space-y-4 h-full overflow-y-auto data-[state=inactive]:hidden">
            <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
              <PracticeControl isActive={activeTab === "practice"} />
            </motion.div>
          </TabsContent>

          {/* Race Session Tab */}
          <TabsContent value="race" className="px-4 space-y-4 h-full overflow-y-auto">
            <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
              <RacingSession />
              <RaceHistory />
            </motion.div>
          </TabsContent>

          {/* Driver Car Manager Tab */}
          <TabsContent value="drivercarmanager" className="space-y-4">
            <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
              {/* Driver Car Manager */}
              <DriverCarManager drivers={drivers} locations={locations} onDriversUpdate={setDrivers} onLocationsUpdate={setLocations} />
            </motion.div>
          </TabsContent>

          {/* Bottom Navigation */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t z-50 shadow-up">
            <TabsList className="grid grid-cols-3 gap-0">
              {/* Practice */}
              <TabsTrigger value="practice" className="py-3">
                <div className="flex flex-col items-center">
                  <CarIcon className="h-5 w-5" />
                  <span className="text-xs mt-1">Practice</span>
                </div>
              </TabsTrigger>

              {/* Race */}
              <TabsTrigger value="race" className="py-3">
                <div className="flex flex-col items-center">
                  <Flag className="h-5 w-5" />
                  <span className="text-xs mt-1">Race</span>
                </div>
              </TabsTrigger>

              {/* settings / Driver Car Manager */}
              <TabsTrigger value="drivercarmanager" className="py-3">
                <div className="flex flex-col items-center">
                  <UserCog className="h-5 w-5" />
                  <span className="text-xs mt-1">Manager</span>
                </div>
              </TabsTrigger>
            </TabsList>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
