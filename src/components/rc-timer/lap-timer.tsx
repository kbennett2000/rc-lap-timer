"use client";

import React, { useState } from "react";
import { Car as CarIcon, UserCog, Flag } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import DriverCarManager from "@/components/driver-car-manager";
import { RacingSession } from "../racing-session";
import { RaceHistory } from "../racing-session/race-history";
import PracticeControl from "./practice-control";
import { ErrorBoundary } from "@/components/error-boundary";

export default function LapTimer() {
  const [activeTab, setActiveTab] = useState("practice");

  // ****************************************
  // return
  // ****************************************
  return (
    <div className="min-h-screen bg-white">
      {/* Main Content Area */}
      <div className="pt-16 pb-20">
        <Tabs defaultValue="practice" className="h-full" value={activeTab} onValueChange={setActiveTab}>
          {/* Practice Tab: always mounted (only hidden when inactive) so a running session survives tab switches */}
          <TabsContent
            value="practice"
            forceMount
            className="px-0 sm:px-4 space-y-4 h-full overflow-y-auto data-[state=inactive]:hidden"
          >
            <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
              <ErrorBoundary>
                <PracticeControl isActive={activeTab === "practice"} />
              </ErrorBoundary>
            </motion.div>
          </TabsContent>

          {/* Race Session Tab */}
          <TabsContent value="race" className="px-0 sm:px-4 space-y-4 h-full overflow-y-auto">
            <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
              <ErrorBoundary>
                <RacingSession />
                <RaceHistory />
              </ErrorBoundary>
            </motion.div>
          </TabsContent>

          {/* Driver Car Manager Tab */}
          <TabsContent value="drivercarmanager" className="space-y-4">
            <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
              <ErrorBoundary>
                <DriverCarManager />
              </ErrorBoundary>
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
