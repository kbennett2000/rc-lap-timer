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
import { errorMessage, useAppData, useDeleteSession, useRefreshData } from "@/data/hooks";
import { formatDateTime } from "@/domain/format";
import type { Session } from "@/domain/types";
import { SessionHistory } from "@/features/history/session-history";
import { useLatest } from "@/hooks/use-latest";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { noopIntegrations } from "@/integrations/noop";
import { createPiIntegrations } from "@/integrations/pi";
import { newId } from "@/lib/utils";
import { CAPABILITIES } from "@/platform/capabilities";
import { keepDataOnDevice } from "@/pwa/storage";
import { now } from "@/timing/clock";
import { toSessionPayload, type FinishedRun, type TimingMode } from "@/timing/engine";
import type { CreatedEntity } from "./add-entity-dialog";
import { CurrentRunCard } from "./current-run-card";
import { BackupReminder } from "./backup-reminder";
import { InstallHint } from "./install-hint";
import { IrTiming } from "./ir-timing";
import { ManualControls } from "./manual-controls";
import { MotionTiming } from "./motion-timing";
import { RecentSessions } from "./recent-sessions";
import { planRunSounds, playRunSounds, type SoundSettings } from "./run-sounds";
import { RunningView } from "./running-view";
import { DeleteSessionDialog } from "./session-card";
import { SessionSetup, type Selection } from "./session-setup";
import { useRemoteControl } from "./use-remote-control";
import { useTimingSession } from "./use-timing-session";
import { useUnsavedSessions, type SaveFailure } from "./use-unsaved-sessions";

// What to tell the user about sessions that couldn't be saved: whether trying again can help.
function unsavedMessage(failures: SaveFailure[]): string {
  const cannotSave = failures.find((failure) => !failure.retryable);
  const what = failures.length === 1 ? "The session" : `${failures.length} sessions`;
  if (cannotSave) {
    return `${what} could not be saved: ${cannotSave.message}. ${failures.length === 1 ? "It is" : "They are"} kept on this device; use Discard at the top of the Practice screen if you don't need ${failures.length === 1 ? "it" : "them"}.`;
  }
  // On the Pi, a save that can be retried failed to reach it; in the phone-only app, the phone's storage failed.
  const retryHint = CAPABILITIES.onDeviceData ? "try again" : "check the connection to the timer, then try again";
  return `${what} could not be saved. ${failures.length === 1 ? "It has" : "They have"} been kept on this device: ${retryHint} with Retry save at the top of the Practice screen.`;
}

const tabMotion = {
  initial: { opacity: 0, x: 50 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.3 },
};

export default function PracticeScreen({ isActive = true }: { isActive?: boolean }) {
  const data = useAppData();
  const refreshData = useRefreshData();
  const deleteSessionChange = useDeleteSession();
  const outbox = useUnsavedSessions();
  const wakeLock = useWakeLock();
  const motionRef = useRef<MotionDetectorHandle>(null);
  // The Pi's LEDs and live view follow the run; the phone-only build has neither.
  const [integrations] = useState(() =>
    CAPABILITIES.ledDisplay || CAPABILITIES.liveSessionView ? createPiIntegrations() : noopIntegrations,
  );

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

  // Read by camera and IR callbacks, which fire outside React renders.
  const latest = useLatest({ data, selection, sounds });

  const handleFinished = useCallback(
    async (run: FinishedRun) => {
      if (run.config.timingMode === "motion") motionRef.current?.stop();
      const outcome = await outbox.saveNew(toSessionPayload(run));
      if (!outcome.ok) alert(unsavedMessage([outcome]));
      // Once there's something worth keeping, ask the browser not to clear it (it decides without asking the user).
      else if (CAPABILITIES.onDeviceData) void keepDataOnDevice();
    },
    [outbox],
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

  // A sync with the timer, or a delete on another phone, can take away what's selected: then it's chosen again,
  // rather than left pointing at nothing.
  useEffect(() => {
    if (running) return;
    const driver = data.drivers.find((d) => d.id === selection.driverId);
    const gone: Partial<Selection> = {};
    if (selection.driverId && !driver) Object.assign(gone, { driverId: "", carId: "" });
    else if (selection.carId && !driver?.cars.some((c) => c.id === selection.carId)) gone.carId = "";
    if (selection.locationId && !data.locations.some((l) => l.id === selection.locationId)) gone.locationId = "";
    if (Object.keys(gone).length > 0) setSelection((current) => ({ ...current, ...gone }));
  }, [data, running, selection.driverId, selection.carId, selection.locationId]);

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
    enabled: CAPABILITIES.remoteControl && remoteControl,
    isIdle: () => store.getState().status !== "running" && !timing.interrupted,
    onRequest: async (request) => {
      // The request may name a driver or car added on another phone moments ago.
      await refreshData();
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

  // The new driver, car or location is already in the shared data, so it can be selected straight away.
  const onCreated = (created: CreatedEntity) => {
    if (created.type === "driver") changeSelection({ driverId: created.entity.id });
    else if (created.type === "car") changeSelection({ carId: created.entity.id });
    else changeSelection({ locationId: created.entity.id });
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
      // Without IR timing there is no IR screen (or Stop button) to go back to, so the run carries on with taps.
      timingMode: config.timingMode === "ir" && !CAPABILITIES.irTiming ? "manual" : config.timingMode,
    });
    timing.resume();
  };

  const retryUnsaved = async () => {
    const failures = await outbox.retryAll();
    if (failures.length > 0) alert(unsavedMessage(failures));
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
    try {
      await deleteSessionChange.mutateAsync(session.id);
      setSessionToDelete(null);
    } catch (error) {
      alert(`Failed to delete the session. ${errorMessage(error)}`);
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
        {CAPABILITIES.onDeviceData && <InstallHint />}
        {CAPABILITIES.onDeviceData && <BackupReminder sessionCount={data.sessions.length} />}

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

          {/* Always mounted (only hidden when inactive): the camera, IR timing and the setup keep running while another
              tab is open. Unmounting it turned the camera off mid-run, so laps were missed. */}
          <TabsContent
            value="current"
            forceMount
            className="px-0 sm:px-4 space-y-4 h-full overflow-y-auto data-[state=inactive]:hidden"
          >
            <motion.div className="space-y-4" {...tabMotion}>
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
                      // Read the clock before unlocking: creating the audio context can take tens of milliseconds.
                      const at = now();
                      unlock();
                      startRun(at);
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
              <SessionNotes sessions={data.sessions} />
            </motion.div>
          </TabsContent>
        </Tabs>

        <DeleteSessionDialog
          session={sessionToDelete}
          deleting={deleteSessionChange.isPending}
          onCancel={() => setSessionToDelete(null)}
          onConfirm={deleteSession}
        />
      </CardContent>
    </Card>
  );
}
