import React, { useState } from "react";
import { Driver, Car, Session } from "@/types/rc-timer"; // Make sure to import Session type
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { User, Car as CarIcon, Pencil, Trash2, AlertTriangle } from "lucide-react";

interface DriverCarManagerProps {
  drivers: Driver[];
  onDriversUpdate: (updatedDrivers: Driver[]) => void;
  onSessionsUpdate?: (updatedSessions: Session[]) => void;
}

const DriverCarManager: React.FC<DriverCarManagerProps> = ({ drivers, onDriversUpdate, onSessionsUpdate }) => {
  const [selectedDriver, setSelectedDriver] = useState<string>("");
  const [selectedCar, setSelectedCar] = useState<string>("");
  const [isEditingDriver, setIsEditingDriver] = useState(false);
  const [isEditingCar, setIsEditingCar] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteType, setDeleteType] = useState<"driver" | "car" | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const currentDriver = drivers.find((d) => d.id === selectedDriver);
  const currentCar = currentDriver?.cars.find((c) => c.id === selectedCar);

  const handleEdit = async () => {
    if (!newName.trim()) return;
    setIsProcessing(true);

    try {
      const endpoint = "/api/manage";
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: isEditingDriver ? "driver" : "car",
          id: isEditingDriver ? selectedDriver : selectedCar,
          newName: newName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update");
      }

      // Update drivers state if we have updated drivers data
      if (data.updatedDrivers) {
        onDriversUpdate(data.updatedDrivers);
      }

      // Update sessions state if we have the callback and updated sessions data
      if (typeof onSessionsUpdate === "function" && data.updatedSessions) {
        onSessionsUpdate(data.updatedSessions);
      }

      // Reset form state
      setNewName("");
      setIsEditingDriver(false);
      setIsEditingCar(false);
    } catch (error) {
      console.error("Error updating:", error);
      alert("Failed to update. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteType) return;
    setIsProcessing(true);

    try {
      const endpoint = "/api/manage";
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: deleteType,
          driverId: selectedDriver,
          carId: deleteType === "car" ? selectedCar : undefined,
        }),
      });

      if (!response.ok) throw new Error("Failed to delete");

      const { success, updatedDrivers } = await response.json();
      if (success) {
        onDriversUpdate(updatedDrivers);
        if (deleteType === "driver") {
          setSelectedDriver("");
        } else {
          setSelectedCar("");
        }
      }
    } catch (error) {
      console.error("Error deleting:", error);
      alert("Failed to delete. Please try again.");
    } finally {
      setIsProcessing(false);
      setDeleteConfirmOpen(false);
      setDeleteType(null);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          <span>Manage Drivers & Cars</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Driver Selection */}
        <div className="space-y-2">
          <Label>Select Driver</Label>
          <div className="flex gap-2">
            <Select
              value={selectedDriver}
              onValueChange={(value) => {
                setSelectedDriver(value);
                setSelectedCar("");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a driver" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((driver) => (
                  <SelectItem key={driver.id} value={driver.id}>
                    {driver.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedDriver && !isEditingDriver && !isEditingCar && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setNewName(currentDriver?.name || "");
                    setIsEditingDriver(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => {
                    setDeleteType("driver");
                    setDeleteConfirmOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Car Selection - Only show if driver is selected */}
        {selectedDriver && !isEditingDriver && (
          <div className="space-y-2">
            <Label>Select Car</Label>
            <div className="flex gap-2">
              <Select value={selectedCar} onValueChange={setSelectedCar}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a car" />
                </SelectTrigger>
                <SelectContent>
                  {currentDriver?.cars.map((car) => (
                    <SelectItem key={car.id} value={car.id}>
                      {car.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCar && !isEditingCar && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setNewName(currentCar?.name || "");
                      setIsEditingCar(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => {
                      setDeleteType("car");
                      setDeleteConfirmOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Edit Form */}
        {(isEditingDriver || isEditingCar) && (
          <div className="space-y-2 pt-4 border-t">
            <Label>{isEditingDriver ? "Edit Driver Name" : "Edit Car Name"}</Label>
            <div className="flex gap-2">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={`Enter new ${isEditingDriver ? "driver" : "car"} name`} />
              <Button onClick={handleEdit} disabled={isProcessing || !newName.trim()}>
                Save
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditingDriver(false);
                  setIsEditingCar(false);
                  setNewName("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Confirm Deletion
              </AlertDialogTitle>
              <AlertDialogDescription>
                {deleteType === "driver" ? <>Are you sure you want to delete driver "{currentDriver?.name}"? This will also delete all their cars and session data.</> : <>Are you sure you want to delete car "{currentCar?.name}"? This will also delete all associated session data.</>}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={isProcessing} className="bg-red-500 hover:bg-red-600">
                {isProcessing ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

export default DriverCarManager;
