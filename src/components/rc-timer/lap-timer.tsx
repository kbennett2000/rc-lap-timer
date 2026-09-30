"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Car as CarIcon, UserCog, Flag } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import DriverCarManager from "@/components/driver-car-manager";
import PracticeControl from "./practice-control";
import { ErrorBoundary } from "@/components/error-boundary";
import { watchTimerClock } from "@/integrations/timer-clock";
import { gridCols } from "@/lib/utils";
import { CAPABILITIES } from "@/platform/capabilities";

// Practice, Race (Pi only) and Manager.
const TAB_COUNT = CAPABILITIES.races ? 3 : 2;

// Race mode is loaded when the Race tab is first opened. The phone-only build has no race mode, and the condition is
// written out in full so that build leaves the code out altogether.
const RaceTab =
  process.env.NEXT_PUBLIC_TARGET === "standalone"
    ? null
    : dynamic(() => import("../racing-session/race-tab"), {
        loading: () => <p className="p-4 text-sm text-muted-foreground">Loading race mode…</p>,
      });

// The phone-only app's offline copy and update offer (src/pwa/app-shell.tsx); the Pi build doesn't have it.
const AppShell =
  process.env.NEXT_PUBLIC_TARGET === "standalone" ? dynamic(() => import("@/pwa/app-shell"), { ssr: false }) : null;

export default function LapTimer() {
  const [activeTab, setActiveTab] = useState("practice");

  // The timer's pages set its clock when it's behind; the phone-only app has no timer to tell.
  useEffect(() => (process.env.NEXT_PUBLIC_TARGET === "standalone" ? undefined : watchTimerClock()), []);

  // ****************************************
  // return
  // ****************************************
  return (
    <div className="min-h-screen bg-white">
      {/* Main Content Area */}
      {/* Room for the bottom bar, and for the home indicator below it on phones without a home button */}
      <div className="pt-16 pb-[calc(5rem+env(safe-area-inset-bottom))]">
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
          {RaceTab && (
            <TabsContent value="race" className="px-0 sm:px-4 space-y-4 h-full overflow-y-auto">
              <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
                <ErrorBoundary>
                  <RaceTab />
                </ErrorBoundary>
              </motion.div>
            </TabsContent>
          )}

          {/* Driver Car Manager Tab */}
          <TabsContent value="drivercarmanager" className="space-y-4">
            <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
              <ErrorBoundary>
                <DriverCarManager />
              </ErrorBoundary>
            </motion.div>
          </TabsContent>

          {/* Bottom Navigation */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t z-50 shadow-up pb-[env(safe-area-inset-bottom)]">
            <TabsList className={`grid ${gridCols(TAB_COUNT)} gap-0`}>
              {/* Practice */}
              <TabsTrigger value="practice" className="py-3">
                <div className="flex flex-col items-center">
                  <CarIcon className="h-5 w-5" />
                  <span className="text-xs mt-1">Practice</span>
                </div>
              </TabsTrigger>

              {/* Race */}
              {RaceTab && (
                <TabsTrigger value="race" className="py-3">
                  <div className="flex flex-col items-center">
                    <Flag className="h-5 w-5" />
                    <span className="text-xs mt-1">Race</span>
                  </div>
                </TabsTrigger>
              )}

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
      {AppShell && <AppShell />}
    </div>
  );
}
