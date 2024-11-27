// src/components/racing-session/race-controls.tsx
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PlayCircle, PauseCircle, StopCircle, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface RaceControlsProps {
  isPaused: boolean;
  onPauseResume: () => void;
  onStop: () => void;
  onDNF: (carNumber: number, reason?: string) => void;
  availableCarNumbers: number[];
}

export const RaceControls: React.FC<RaceControlsProps> = ({ isPaused, onPauseResume, onStop, onDNF, availableCarNumbers }) => {
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [showDNFDialog, setShowDNFDialog] = useState(false);
  const [selectedCar, setSelectedCar] = useState<string>("");
  const [dnfReason, setDnfReason] = useState("");

  const handleDNFConfirm = () => {
    if (selectedCar) {
      onDNF(parseInt(selectedCar), dnfReason);
      setShowDNFDialog(false);
      setSelectedCar("");
      setDnfReason("");
    }
  };

  return (
    <div className="space-y-4">
      {/* Main Controls */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={onPauseResume} variant={isPaused ? "default" : "secondary"} className="flex-1">
          {isPaused ? (
            <>
              <PlayCircle className="mr-2 h-5 w-5" />
              Resume Race
            </>
          ) : (
            <>
              <PauseCircle className="mr-2 h-5 w-5" />
              Pause Race
            </>
          )}
        </Button>

        <Button onClick={() => setShowStopConfirm(true)} variant="destructive" className="flex-1">
          <StopCircle className="mr-2 h-5 w-5" />
          End Race
        </Button>

        <Button onClick={() => setShowDNFDialog(true)} variant="destructive" className="flex-1">
          <AlertTriangle className="mr-2 h-5 w-5" />
          Mark DNF
        </Button>
      </div>

      {/* Stop Race Confirmation Dialog */}
      <AlertDialog open={showStopConfirm} onOpenChange={setShowStopConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End Race</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to end this race? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onStop();
                setShowStopConfirm(false);
              }}
              className="bg-red-500 hover:bg-red-600"
            >
              End Race
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DNF Dialog */}
      <AlertDialog open={showDNFDialog} onOpenChange={setShowDNFDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Car as DNF</AlertDialogTitle>
            <AlertDialogDescription>Select the car to mark as Did Not Finish (DNF).</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Car</Label>
              <Select value={selectedCar} onValueChange={setSelectedCar}>
                <SelectTrigger>
                  <SelectValue placeholder="Select car number" />
                </SelectTrigger>
                <SelectContent>
                  {(availableCarNumbers || []).map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      Car #{num}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Reason (Optional)</Label>
              <Input value={dnfReason} onChange={(e) => setDnfReason(e.target.value)} placeholder="Enter reason for DNF" />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDNFConfirm} disabled={!selectedCar} className="bg-red-500 hover:bg-red-600">
              Confirm DNF
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
