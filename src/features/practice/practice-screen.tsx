"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Car as CarIcon, ChartArea, ClipboardList, History, NotebookPen, Trophy } from "lucide-react";
import { unlockAudio } from "@/audio";
import { BestLapsComparison } from "@/components/rc-timer/best-laps-comparison";
import type { MotionDetectorHandle } from "@/components/rc-timer/motion-detector";
import { SessionComparison } from "@/components/rc-timer/session-comparison";
import { SessionNotes } from "@/components/rc-timer/session-notes";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime } from "@/domain/format";
import type { Session } from "@/domain/types";
import { SessionHistory } from "@/features/history/session-history";
import { useLatest } from "@/hooks/use-latest";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { createPiIntegrations } from "@/integrations/pi";
import { logger } from "@/lib/logger";
import { newId } from "@/lib/utils";
import { now } from "@/timing/clock";
import { toSessionPayload, type FinishedRun, type TimingMode } from "@/timing/engine";
import type { CreatedEntity } from "./add-entity-dialog";
import { CurrentRunCard } from "./current-run-card";
import { IrTiming } from "./ir-timing";
import { ManualControls } from "./manual-controls";
import { MotionTiming } from "./motion-timing";
import { RecentSessions } from "./recent-sessions";
import { planRunSounds, playRunSounds, type SoundSettings } from "./run-sounds";
import { RunningView } from "./running-view";
import { DeleteSessionDialog } from "./session-card";
import { SessionSetup, type Selection } from "./session-setup";
import { usePracticeData } from "./use-practice-data";
import { useRemoteControl } from "./use-remote-control";
import { useTimingSession } from "./use-timing-session";
import { useUnsavedSessions } from "./use-unsaved-sessions";

const tabMotion = {
  initial: { opacity: 0, x: 50 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.3 },
};

export default function PracticeScreen({ isActive = true }: { isActive?: boolean }) {
  const data = usePracticeData(isActive);
  const outbox = useUnsavedSessions();
  const wakeLock = useWakeLock();
  const motionRef = useRef<MotionDetectorHandle>(null);
  const [integrations] = useState(() => createPiIntegrations());

  const [activeTab, setActiveTab] = useState("current");
  const [selection, setSelection] = useState<Selection>({
    driverId: "",
    carId: "",
    locationId: "",
    lapTarget: "unlimited",
    timingMode: "manual",
  });
  const [sounds, setSounds] = useState<SoundSettings>({
    beeps: false,
    announceLapNumber: false,
    announceLastLapTime: false,
  });
  const [remoteControl, setRemoteControl] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Read by camera and IR callbacks, which fire outside React renders.
  const latest = useLatest({ data, selection, sounds });

  const handleFinished = useCallback(
    async (run: FinishedRun) => {
      if (run.config.timingMode === "motion") motionRef.current?.stop();
      if (await outbox.saveNew(toSessionPayload(run))) {
        await latest.current.data.reload();
      } else {
        alert(
          "The session could not be saved. It has been kept on this device: use Retry save at the top of the Practice screen.",
        );
      }
    },
    [outbox, latest],
  );

  const timing = useTimingSession({ integrations, onFinished: handleFinished });
  const { run, dispatch, store } = timing;
  const running = run.status === "running";

  useEffect(
    () =>
      store.addEffect((next, previous, event) =>
        playRunSounds(planRunSounds(next, previous, event, latest.current.sounds)),
      ),
    [store, latest],
  );

  // Keep the screen on while timing: a run, the camera, or IR timing waiting for the first crossing.
  const keepAwake = running || (cameraOn && selection.timingMode === "motion") || selection.timingMode === "ir";
  const { release: releaseWakeLock } = wakeLock;
  useEffect(() => {
    if (!keepAwake) releaseWakeLock();
  }, [keepAwake, releaseWakeLock]);

  // Called inside taps: sounds and the wake lock both need a user gesture on phones.
  const unlock = () => {
    unlockAudio();
    wakeLock.request();
  };

  const startRun = (at: number) => {
    const { data: d, selection: s } = latest.current;
    if (!s.driverId || !s.carId || !s.locationId) {
      alert("Please select a driver, car, and location before starting the timer");
      return;
    }
    const driver = d.drivers.find((x) => x.id === s.driverId);
    dispatch({
      type: "start",
      at,
      id: newId(),
      config: {
        driverId: s.driverId,
        driverName: driver?.name ?? "Unknown driver",
        carId: s.carId,
        carName: driver?.cars.find((c) => c.id === s.carId)?.name ?? "Unknown car",
        locationId: s.locationId,
        locationName: d.locations.find((l) => l.id === s.locationId)?.name ?? "",
        lapTarget: s.lapTarget,
        timingMode: s.timingMode,
      },
    });
  };

  // A sensor crossing: the first one starts the run, the rest are laps.
  const onCrossing = (at: number) => {
    if (store.getState().status === "running") dispatch({ type: "lap", at });
    else startRun(at);
  };

  useRemoteControl({
    enabled: remoteControl,
    isIdle: () => store.getState().status !== "running" && !timing.interrupted,
    onRequest: async (request) => {
      await data.reload();
      setSelection((s) => ({
        ...s,
        driverId: request.driverId,
        carId: request.carId,
        locationId: request.locationId,
        lapTarget: request.numberOfLaps,
        timingMode: "motion",
      }));
      if (!motionRef.current) throw new Error("The motion detector isn't ready");
      await motionRef.current.start();
    },
  });

  const changeSelection = (change: Partial<Selection>) =>
    setSelection((s) => {
      const next = { ...s, ...change };
      // A new driver means their cars; keep the car only if it was chosen in the same change.
      if (change.driverId !== undefined && change.driverId !== s.driverId && change.carId === undefined) {
        next.carId = "";
      }
      return next;
    });

  const onCreated = (created: CreatedEntity) => {
    if (created.type === "driver") {
      data.setDrivers((prev) => [...prev, { ...created.entity, cars: created.entity.cars ?? [] }]);
      changeSelection({ driverId: created.entity.id });
    } else if (created.type === "car") {
      const car = created.entity;
      data.setDrivers((prev) => prev.map((d) => (d.id === car.driverId ? { ...d, cars: [...d.cars, car] } : d)));
      changeSelection({ carId: car.id });
    } else {
      data.setLocations((prev) => [...prev, created.entity]);
      changeSelection({ locationId: created.entity.id });
    }
  };

  const resumeInterrupted = () => {
    const interrupted = timing.interrupted;
    if (!interrupted) return;
    unlock();
    const { config } = interrupted;
    setSelection({
      driverId: config.driverId,
      carId: config.carId,
      locationId: config.locationId,
      lapTarget: config.lapTarget,
      timingMode: config.timingMode,
    });
    timing.resume();
  };

  const retryUnsaved = async () => {
    const failed = await outbox.retryAll();
    await data.reload();
    if (failed > 0) {
      alert(
        `${failed === 1 ? "A session" : `${failed} sessions`} still could not be saved. Check the connection to the timer and try again.`,
      );
    }
  };

  const discardUnsaved = () => {
    const count = outbox.unsaved.length;
    const message =
      count === 1
        ? "Discard this unsaved session? Its laps will be lost."
        : `Discard these ${count} unsaved sessions? Their laps will be lost.`;
    if (confirm(message)) outbox.discardAll();
  };

  const deleteSession = async (session: Session) => {
    setDeleting(true);
    try {
      const response = await fetch("/api/data", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: session.id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || "Failed to delete session");
      data.setSessions((prev) => prev.filter((s) => s.id !== session.id));
      setSessionToDelete(null);
    } catch (error) {
      logger.error("Error deleting session:", error);
      alert("Failed to delete session. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const selectedCar = data.drivers.find((d) => d.id === selection.driverId)?.cars.find((c) => c.id === selection.carId);
  const interrupted = timing.interrupted;

  return (
    <Card className="w-full border-0 shadow-none sm:border sm:shadow-sm">
      <CardHeader className="px-0 sm:px-6">
        <CardTitle>Practice</CardTitle>
      </CardHeader>
      <CardContent className="px-0 sm:px-6">
        {interrupted && (
          <Alert className="mb-4 border-blue-300 bg-blue-50">
            <History className="h-4 w-4" />
            <AlertTitle>A session was running</AlertTitle>
            <AlertDescription>
              {interrupted.config.driverName} / {interrupted.config.carName}, {interrupted.crossings.length}{" "}
              {interrupted.crossings.length === 1 ? "lap" : "laps"}, started{" "}
              {formatDateTime(new Date(interrupted.startedAt).toISOString())}.
              {interrupted.config.timingMode === "motion" && " After Resume, tap Cam On to carry on timing."}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" onClick={resumeInterrupted}>
                  Resume
                </Button>
                <Button size="sm" variant="outline" onClick={timing.finishInterrupted}>
                  Finish and save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (confirm("Discard the interrupted session? Its laps will be lost.")) timing.discardInterrupted();
                  }}
                >
                  Discard
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {outbox.unsaved.length > 0 && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              {outbox.unsaved.length === 1 ? "Session not saved" : `${outbox.unsaved.length} sessions not saved`}
            </AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5">
                {outbox.unsaved.map((pending) => (
                  <li key={pending.id}>
                    {pending.driverName} / {pending.carName}, {pending.laps?.length ?? 0} laps
                    {pending.date ? ` (${formatDateTime(pending.date)})` : ""}
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={retryUnsaved} disabled={outbox.isRetrying}>
                  {outbox.isRetrying ? "Saving..." : "Retry save"}
                </Button>
                <Button size="sm" variant="outline" onClick={discardUnsaved} disabled={outbox.isRetrying}>
                  Discard
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Tabs className="h-full" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full h-full grid-cols-5">
            <TabsTrigger value="current" className="py-3">
              <div className="flex flex-col items-center">
                <CarIcon className="h-5 w-5" />
                <span className="text-xs mt-1">Current</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="previous" className="py-3">
              <div className="flex flex-col items-center">
                <ClipboardList className="h-5 w-5" />
                <span className="text-xs mt-1">
                  Session
                  <br /> Mgmt
                </span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="best" className="py-3">
              <div className="flex flex-col items-center">
                <Trophy className="h-5 w-5" />
                <span className="text-xs mt-1">Best</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="compare" className="py-3">
              <div className="flex flex-col items-center">
                <ChartArea className="h-5 w-5" />
                <span className="text-xs mt-1">Compare</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="notes" className="py-3">
              <div className="flex flex-col items-center">
                <NotebookPen className="h-5 w-5" />
                <span className="text-xs mt-1">Notes</span>
              </div>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="px-0 sm:px-4 space-y-4 h-full overflow-y-auto">
            <motion.div key={activeTab} className="space-y-4" {...tabMotion}>
              <SessionSetup
                drivers={data.drivers}
                locations={data.locations}
                selection={selection}
                onSelectionChange={changeSelection}
                sounds={sounds}
                onSoundsChange={(change) => setSounds((s) => ({ ...s, ...change }))}
                remoteControl={remoteControl}
                onRemoteControlChange={(enabled) => {
                  setRemoteControl(enabled);
                  if (enabled) changeSelection({ timingMode: "motion" });
                }}
                onTimingModeTap={(mode: TimingMode) => {
                  if (mode === "ir") unlock();
                }}
                locked={running}
                onCreated={onCreated}
              />

              <RunningView
                run={run}
                visible={isActive && activeTab === "current"}
                screenKeptOn={wakeLock.active}
                wakeLockSupported={wakeLock.supported}
              >
                {selection.timingMode === "manual" && (
                  <ManualControls
                    running={running}
                    canStart={Boolean(selection.driverId && selection.carId)}
                    onStart={() => {
                      unlock();
                      startRun(now());
                    }}
                    onLap={() => dispatch({ type: "lap", at: now() })}
                    onStop={() => dispatch({ type: "finish", at: now() })}
                    onPenalty={() => dispatch({ type: "penalty", at: now() })}
                  />
                )}
                {selection.timingMode === "motion" && (
                  <MotionTiming
                    ref={motionRef}
                    running={running}
                    soundOn={sounds.beeps}
                    onCrossing={onCrossing}
                    onUserStart={unlock}
                    onCameraChange={setCameraOn}
                    onStop={() => dispatch({ type: "end", at: now() })}
                  />
                )}
                {selection.timingMode === "ir" && (
                  <IrTiming
                    carNumber={selectedCar?.defaultCarNumber ? String(selectedCar.defaultCarNumber) : ""}
                    running={running}
                    onCarDetected={onCrossing}
                    onStop={() => dispatch({ type: "end", at: now() })}
                  />
                )}
              </RunningView>

              {run.status === "running" && run.crossings.length > 0 && <CurrentRunCard run={run} />}

              <RecentSessions sessions={data.sessions} onDelete={setSessionToDelete} />
            </motion.div>
          </TabsContent>

          <TabsContent value="previous" className="px-0 sm:px-4 space-y-4 h-full overflow-y-auto">
            <motion.div key={activeTab} className="space-y-4" {...tabMotion}>
              <SessionHistory
                sessions={data.sessions}
                drivers={data.drivers}
                locations={data.locations}
                onDelete={setSessionToDelete}
              />
            </motion.div>
          </TabsContent>

          <TabsContent value="best" className="px-0 sm:px-4 space-y-4 h-full overflow-y-auto">
            <motion.div key={activeTab} {...tabMotion}>
              <BestLapsComparison sessions={data.sessions} />
            </motion.div>
          </TabsContent>

          <TabsContent value="compare" className="px-0 sm:px-4 space-y-4 h-full overflow-y-auto">
            <motion.div key={activeTab} {...tabMotion}>
              <SessionComparison sessions={data.sessions} />
            </motion.div>
          </TabsContent>

          <TabsContent value="notes" className="px-0 sm:px-4 space-y-4 h-full overflow-y-auto">
            <motion.div key={activeTab} {...tabMotion}>
              <SessionNotes
                sessions={data.sessions}
                onNotesSaved={(sessionId, notes) =>
                  data.setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, notes } : s)))
                }
              />
            </motion.div>
          </TabsContent>
        </Tabs>

        <DeleteSessionDialog
          session={sessionToDelete}
          deleting={deleting}
          onCancel={() => setSessionToDelete(null)}
          onConfirm={deleteSession}
        />
      </CardContent>
    </Card>
  );
}
