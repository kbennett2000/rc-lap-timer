"use client";

import { AlertTriangle, Loader2, Trash2, Turtle, Zap } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatLapTime } from "@/domain/format";
import type { Session } from "@/domain/types";
import { cn } from "@/lib/utils";

// One saved session: its laps (fastest, slowest and penalties flagged) and stats.
export function SessionCard({ session, onDelete }: { session: Session; onDelete: (session: Session) => void }) {
  const times = session.laps.map((lap) => lap.lapTime);
  const fastest = Math.min(...times);
  const slowest = Math.max(...times);
  const { stats } = session;

  return (
    <div className="border-t pt-4 first:border-t-0 first:pt-0">
      <div className="flex justify-between items-center mb-2">
        <div>
          <h3 className="font-semibold">{formatDateTime(session.date)}</h3>
          <div className="text-sm text-muted-foreground">
            Driver: {session.driverName} - Car: {session.carName} - Location: {session.locationName}
          </div>
        </div>
        <Button
          onClick={() => onDelete(session)}
          variant="destructive"
          size="sm"
          className="bg-red-500 hover:bg-red-600"
          aria-label="Delete session"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="font-semibold mb-2">Lap Times:</h4>
          {[...session.laps]
            .sort((a, b) => a.lapNumber - b.lapNumber)
            .map((lap) => {
              const isFastest = lap.lapTime === fastest;
              const isSlowest = lap.lapTime === slowest;
              const penalties = session.penalties?.find((p) => p.lapNumber === lap.lapNumber)?.count ?? 0;
              const hasMostPenalties = Boolean(stats?.maxPenaltyLap === lap.lapNumber && stats.maxPenaltyCount > 0);
              return (
                <div
                  key={lap.lapNumber}
                  className={cn(
                    "font-mono flex items-center",
                    isFastest && "text-green-600 font-bold",
                    isSlowest && "text-red-600 font-bold",
                    hasMostPenalties && "bg-yellow-50",
                  )}
                >
                  <span className="min-w-[100px]">
                    Lap {lap.lapNumber}: {formatLapTime(lap.lapTime)}
                  </span>
                  {(isFastest || isSlowest || penalties > 0 || hasMostPenalties) && (
                    <div className="flex flex-wrap gap-1 mt-1 ml-4">
                      {isFastest && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                          <Zap className="h-3 w-3 mr-1" />
                        </span>
                      )}
                      {isSlowest && (
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                          <Turtle className="h-3 w-3 mr-1" />
                        </span>
                      )}
                      {penalties > 0 && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                          {penalties} {penalties === 1 ? "Penalty" : "Penalties"}
                        </span>
                      )}
                      {hasMostPenalties && (
                        <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                        </span>
                      )}
                    </div>
                  )}
                  <div className="my-2" />
                </div>
              );
            })}
        </div>

        <div className="border-t md:border-t-0 pt-4 md:pt-0 mt-4 md:mt-0">
          <h4 className="font-semibold mb-2">Statistics:</h4>
          {stats && (
            <div className="space-y-2">
              <div className="font-mono">Average: {formatLapTime(stats.average)}</div>
              <div className="space-y-1 mt-2">
                <div className="font-mono text-green-600 font-bold">Best Lap: {formatLapTime(stats.bestLap)}</div>
                <div className="font-mono text-red-600 font-bold">Slowest Lap: {formatLapTime(stats.worstLap)}</div>
                <div className="font-mono mt-2">Total Penalties: {stats.totalPenalties}</div>
              </div>
              <div className="font-mono mt-2">Total Time: {formatLapTime(stats.totalTime)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DeleteSessionDialog({
  session,
  deleting,
  onCancel,
  onConfirm,
}: {
  session: Session | null;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: (session: Session) => void;
}) {
  return (
    <AlertDialog open={!!session} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Session</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the session from {session ? formatDateTime(session.date) : ""}? If you
            delete this session, it&apos;s gone for good. So make sure this is what you really want to do!!
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={deleting}
            onClick={() => session && onConfirm(session)}
            className="bg-red-500 hover:bg-red-600"
          >
            {deleting ? (
              <span className="flex items-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </span>
            ) : (
              "Delete"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
