import React, { useState, useEffect } from "react";
import { Driver, Car } from "@/types/rc-timer";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { User, Car as CarIcon, Pencil, Trash2, AlertTriangle, Settings2 } from "lucide-react";

interface MotionSettings {
  id: string;
  name: string;
  sensitivity: number;
  threshold: number;
  cooldown: number;
  framesToSkip: number;
}

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
  const [isEditingMotionSetting, setIsEditingMotionSetting] = useState(false);
  const [showNewDriver, setShowNewDriver] = useState(false);
  const [showNewCar, setShowNewCar] = useState(false);
  const [newDriverName, setNewDriverName] = useState("");
  const [newCarName, setNewCarName] = useState("");
  const [motionSettings, setMotionSettings] = useState<MotionSettings[]>([]);
  const [selectedMotionSetting, setSelectedMotionSetting] = useState<string>("");

  const currentDriver = drivers.find((d) => d.id === selectedDriver);
  const currentCar = currentDriver?.cars.find((c) => c.id === selectedCar);
  const currentMotionSetting = motionSettings.find((s) => s.id === selectedMotionSetting);

  // Load motion settings on mount
  useEffect(() => {
    loadMotionSettings();
  }, []);

  const loadMotionSettings = async () => {
    try {
      const response = await fetch("/api/motion-settings");
      if (response.ok) {
        const data = await response.json();
        setMotionSettings(data);
      }
    } catch (error) {
      console.error("Error loading motion settings:", error);
    }
  };

  const handleEdit = async () => {
    if (!newName.trim()) return;
    setIsProcessing(true);

    try {
      const endpoint = "/api/manage";
      let body;

      if (isEditingMotionSetting) {
        body = {
          type: "motionSetting",
          id: selectedMotionSetting,
          newName: newName.trim(),
        };
      } else {
        body = {
          type: isEditingDriver ? "driver" : "car",
          id: isEditingDriver ? selectedDriver : selectedCar,
          newName: newName.trim(),
        };
      }

      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update");
      }

      if (data.success) {
        if (isEditingMotionSetting) {
          await loadMotionSettings();
        } else {
          if (data.updatedDrivers) {
            onDriversUpdate(data.updatedDrivers);
          }
          if (onSessionsUpdate && data.updatedSessions) {
            onSessionsUpdate(data.updatedSessions);
          }
        }

        setNewName("");
        setIsEditingDriver(false);
        setIsEditingCar(false);
        setIsEditingMotionSetting(false);
      }
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
      let body;

      if (deleteType === "motionSetting") {
        body = {
          type: "motionSetting",
          id: selectedMotionSetting,
        };
      } else {
        body = {
          type: deleteType,
          driverId: selectedDriver,
          carId: deleteType === "car" ? selectedCar : undefined,
        };
      }

      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error("Failed to delete");

      const { success, updatedDrivers } = await response.json();
      if (success) {
        if (deleteType === "motionSetting") {
          await loadMotionSettings();
          setSelectedMotionSetting("");
        } else {
          onDriversUpdate(updatedDrivers);
          if (deleteType === "driver") {
            setSelectedDriver("");
          } else {
            setSelectedCar("");
          }
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

  const handleAddDriver = async () => {
    const trimmedName = newDriverName.trim();
    if (!trimmedName) {
      alert("Please enter a driver name");
      return;
    }

    if (drivers.some((d) => d.name.toLowerCase() === trimmedName.toLowerCase())) {
      alert("A driver with this name already exists");
      return;
    }

    try {
      const response = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "driver",
          name: trimmedName,
        }),
      });

      if (!response.ok) throw new Error("Failed to create driver");

      const { driver } = await response.json();
      onDriversUpdate([...drivers, driver]);
      setSelectedDriver(driver.id);
      setNewDriverName("");
      setShowNewDriver(false);
    } catch (error) {
      console.error("Error creating driver:", error);
      alert("Failed to create driver. Please try again.");
    }
  };

  const handleAddCar = async () => {
    const trimmedName = newCarName.trim();
    if (!selectedDriver) {
      alert("Please select a driver first");
      return;
    }

    if (!trimmedName) {
      alert("Please enter a car name");
      return;
    }

    const currentDriver = drivers.find((d) => d.id === selectedDriver);
    if (currentDriver?.cars.some((c) => c.name.toLowerCase() === trimmedName.toLowerCase())) {
      alert(`${currentDriver.name} already has a car with this name`);
      return;
    }

    try {
      const response = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "car",
          name: trimmedName,
          driverId: selectedDriver,
        }),
      });

      if (!response.ok) throw new Error("Failed to create car");

      const { car } = await response.json();
      onDriversUpdate(drivers.map((driver) => (driver.id === selectedDriver ? { ...driver, cars: [...driver.cars, car] } : driver)));
      setSelectedCar(car.id);
      setNewCarName("");
      setShowNewCar(false);
    } catch (error) {
      console.error("Error creating car:", error);
      alert("Failed to create car. Please try again.");
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Manage Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="drivers">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="drivers">Drivers & Cars</TabsTrigger>
            <TabsTrigger value="motionSettings">Motion Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="drivers" className="space-y-4">
            {/* Add New Driver */}
            <div className="space-y-2">
              <Button variant="outline" onClick={() => setShowNewDriver(!showNewDriver)}>
                <User className="mr-2 h-4 w-4" />
                Add New Driver
              </Button>

              {showNewDriver && (
                <div className="space-y-2">
                  <Input
                    placeholder="Enter driver name"
                    value={newDriverName}
                    onChange={(e) => setNewDriverName(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") handleAddDriver();
                    }}
                  />
                  <Button onClick={handleAddDriver}>Add Driver</Button>
                </div>
              )}
            </div>

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

            {/* Add New Car (when driver is selected) */}
            {selectedDriver && (
              <div className="space-y-2">
                <Button variant="outline" onClick={() => setShowNewCar(!showNewCar)}>
                  <CarIcon className="mr-2 h-4 w-4" />
                  Add New Car
                </Button>

                {showNewCar && (
                  <div className="space-y-2">
                    <Input
                      placeholder="Enter car name"
                      value={newCarName}
                      onChange={(e) => setNewCarName(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") handleAddCar();
                      }}
                    />
                    <Button onClick={handleAddCar}>Add Car</Button>
                  </div>
                )}
              </div>
            )}

            {/* Car Selection */}
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
          </TabsContent>

          <TabsContent value="motionSettings" className="space-y-4">
            {/* Motion Settings Selection */}
            <div className="space-y-2">
              <Label>Select Motion Setting</Label>
              <div className="flex gap-2">
                <Select value={selectedMotionSetting} onValueChange={setSelectedMotionSetting}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a motion setting" />
                  </SelectTrigger>
                  <SelectContent>
                    {motionSettings.map((setting) => (
                      <SelectItem key={setting.id} value={setting.id}>
                        {setting.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedMotionSetting && !isEditingMotionSetting && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setNewName(currentMotionSetting?.name || "");
                        setIsEditingMotionSetting(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => {
                        setDeleteType("motionSetting");
                        setDeleteConfirmOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Edit Form */}
        {(isEditingDriver || isEditingCar || isEditingMotionSetting) && (
          <div className="space-y-2 pt-4 border-t">
            <Label>{isEditingDriver ? "Edit Driver Name" : isEditingCar ? "Edit Car Name" : "Edit Motion Setting Name"}</Label>
            <div className="flex gap-2">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={`Enter new ${isEditingDriver ? "driver" : isEditingCar ? "car" : "motion setting"} name`} />
              <Button onClick={handleEdit} disabled={isProcessing || !newName.trim()}>
                Save
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditingDriver(false);
                  setIsEditingCar(false);
                  setIsEditingMotionSetting(false);
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
                {deleteType === "driver" ? (
                  <>Are you sure you want to delete driver "{currentDriver?.name}"? This will also delete all their cars and session data.</>
                ) : deleteType === "car" ? (
                  <>Are you sure you want to delete car "{currentCar?.name}"? This will also delete all associated session data.</>
                ) : (
                  <>Are you sure you want to delete motion setting "{currentMotionSetting?.name}"?</>
                )}
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
