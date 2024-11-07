import React, { useState, useEffect } from "react";
import { Driver, Location, Session } from "@/types/rc-timer";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { User, Car as CarIcon, Pencil, Trash2, AlertTriangle, Plus, Map, SlidersHorizontal, Users } from "lucide-react";
import { logger } from "@/lib/logger";

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
  locations: Location[];
  onDriversUpdate: (updatedDrivers: Driver[]) => void;
  onSessionsUpdate?: (updatedSessions: Session[]) => void;
  onLocationsUpdate: (updatedLocations: Location[]) => void;
}

type EntityType = "driver" | "car" | "location" | "motionSetting";
type ActionType = "add" | "edit";

interface EntityDialogState {
  isOpen: boolean;
  type: EntityType | null;
  action: ActionType | null;
  entityId?: string;
  initialValue?: string;
}

const DriverCarManager: React.FC<DriverCarManagerProps> = ({ drivers, locations, onDriversUpdate, onLocationsUpdate, onSessionsUpdate }) => {
  // Selection states
  const [selectedDriver, setSelectedDriver] = useState<string>("");
  const [selectedCar, setSelectedCar] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [selectedMotionSetting, setSelectedMotionSetting] = useState<string>("");

  // Entity management states
  const [motionSettings, setMotionSettings] = useState<MotionSettings[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [entityDialogState, setEntityDialogState] = useState<EntityDialogState>({
    isOpen: false,
    type: null,
    action: null,
  });
  const [entityName, setEntityName] = useState("");

  // Delete confirmation state
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    type: EntityType | null;
    entityId?: string;
  }>({
    isOpen: false,
    type: null,
  });

  // Current entities
  const currentDriver = drivers.find((d) => d.id === selectedDriver);
  const currentCar = currentDriver?.cars.find((c) => c.id === selectedCar);
  const currentLocation = locations.find((l) => l.id === selectedLocation);
  const currentMotionSetting = motionSettings.find((s) => s.id === selectedMotionSetting);

  useEffect(() => {
    loadMotionSettings();
  }, []);

  const openEntityDialog = (type: EntityType, action: ActionType, entityId?: string, initialValue: string = "") => {
    setEntityDialogState({
      isOpen: true,
      type,
      action,
      entityId,
      initialValue,
    });
    setEntityName(initialValue);
  };

  const closeEntityDialog = () => {
    setEntityDialogState({
      isOpen: false,
      type: null,
      action: null,
    });
    setEntityName("");
  };

  const handleEntitySubmit = async () => {
    const { type, action, entityId } = entityDialogState;
    if (!type || !action || !entityName.trim()) return;

    setIsProcessing(true);
    try {
      const isAdd = action === "add";
      const endpoint = isAdd ? "/api/data" : "/api/manage";
      const method = isAdd ? "POST" : "PATCH";

      let body: any = { name: entityName.trim() };

      if (isAdd) {
        body.type = type;
        if (type === "car") {
          body.driverId = selectedDriver;
        }
      } else {
        body.type = type;
        body.id = entityId;
        body.newName = entityName.trim();
      }

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error("Operation failed");

      const data = await response.json();

      if (data.success || data.driver || data.car || data.location) {
        if (data.updatedDrivers) onDriversUpdate(data.updatedDrivers);
        if (data.updatedLocations) onLocationsUpdate(data.updatedLocations);
        if (onSessionsUpdate && data.updatedSessions) onSessionsUpdate(data.updatedSessions);

        // Update selections for newly created entities
        if (data.driver) setSelectedDriver(data.driver.id);
        if (data.car) setSelectedCar(data.car.id);
        if (data.location) setSelectedLocation(data.location.id);
      }

      closeEntityDialog();
    } catch (error) {
      logger.error("Error in entity operation:", error);
      alert("Operation failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const loadMotionSettings = async () => {
    try {
      const response = await fetch("/api/motion-settings");
      if (response.ok) {
        const data = await response.json();
        setMotionSettings(data);
      }
    } catch (error) {
      logger.error("Error loading motion settings:", error);
    }
  };

  const handleDelete = async () => {
    const { type, entityId } = deleteDialog;
    if (!type) return;

    setIsProcessing(true);
    try {
      let endpoint = "/api/manage";
      let body: any = { type };

      switch (type) {
        case "motionSetting":
          endpoint = `/api/motion-settings?id=${selectedMotionSetting}`;
          break;
        case "location":
          body.id = selectedLocation;
          break;
        case "driver":
          body.driverId = selectedDriver;
          break;
        case "car":
          body.driverId = selectedDriver;
          body.carId = selectedCar;
          break;
      }

      const response = await fetch(endpoint, {
        method: "DELETE",
        ...(type !== "motionSetting" && {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      });

      if (!response.ok) throw new Error("Delete operation failed");

      const data = await response.json();

      if (data.success) {
        if (type === "motionSetting") {
          await loadMotionSettings();
          setSelectedMotionSetting("");
        } else if (type === "location") {
          onLocationsUpdate(data.updatedLocations);
          setSelectedLocation("");
        } else {
          onDriversUpdate(data.updatedDrivers);
          if (type === "driver") setSelectedDriver("");
          else setSelectedCar("");
        }
      }
    } catch (error) {
      logger.error("Error deleting:", error);
      alert("Failed to delete. Please try again.");
    } finally {
      setIsProcessing(false);
      setDeleteDialog({ isOpen: false, type: null });
    }
  };

  const isNameValid = () => {
    const trimmedName = entityName.trim().toLowerCase();
    const { type, action } = entityDialogState;

    if (action === "add") {
      switch (type) {
        case "driver":
          return !drivers.some((d) => d.name.toLowerCase() === trimmedName);
        case "car":
          return !currentDriver?.cars.some((c) => c.name.toLowerCase() === trimmedName);
        case "location":
          return !locations.some((l) => l.name.toLowerCase() === trimmedName);
        default:
          return true;
      }
    }
    return true;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Manage Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="drivers">
          <TabsList className="grid w-full h-full grid-cols-3">
            
            <TabsTrigger value="drivers">              
              <div className="flex flex-col items-center">
                      <Users className="h-5 w-5" />
                      <span className="text-xs mt-1">Drivers & Cars</span>
                    </div>
              </TabsTrigger>
            

            <TabsTrigger value="locations">
              
              <div className="flex flex-col items-center">
                      <Map className="h-5 w-5" />
                      <span className="text-xs mt-1">Locations</span>
                    </div>
              </TabsTrigger>
            

            <TabsTrigger value="motionSettings">
              <div className="flex flex-col items-center">
                      <SlidersHorizontal className="h-5 w-5" />
                      <span className="text-xs mt-1">Motion Settings</span>
                    </div>
              </TabsTrigger>


          </TabsList>

          {/* Drivers & Cars Tab */}
          <TabsContent value="drivers" className="space-y-4">
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
                {selectedDriver && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => openEntityDialog("driver", "edit", selectedDriver, currentDriver?.name)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() =>
                        setDeleteDialog({
                          isOpen: true,
                          type: "driver",
                          entityId: selectedDriver,
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <Button variant="outline" onClick={() => openEntityDialog("driver", "add")}>
                <User className="mr-2 h-4 w-4" />
                Add New Driver
              </Button>
            </div>

            {selectedDriver && (
              <>
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
                    {selectedCar && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={() => openEntityDialog("car", "edit", selectedCar, currentCar?.name)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() =>
                            setDeleteDialog({
                              isOpen: true,
                              type: "car",
                              entityId: selectedCar,
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <Button variant="outline" onClick={() => openEntityDialog("car", "add")}>
                  <CarIcon className="mr-2 h-4 w-4" />
                  Add New Car
                </Button>
              </>
            )}
          </TabsContent>

          {/* Locations Tab */}
          <TabsContent value="locations" className="space-y-4">
            <div className="space-y-2">
              <Label>Manage Locations</Label>
              <div className="flex gap-2">
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {selectedLocation && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => openEntityDialog("location", "edit", selectedLocation, currentLocation?.name)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() =>
                        setDeleteDialog({
                          isOpen: true,
                          type: "location",
                          entityId: selectedLocation,
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <Button variant="outline" onClick={() => openEntityDialog("location", "add")}>
                <Map className="mr-2 h-4 w-4" />
                Add New Location
              </Button>
            </div>
          </TabsContent>

          {/* Motion Settings Tab */}
          <TabsContent value="motionSettings" className="space-y-4">
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
                {selectedMotionSetting && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => openEntityDialog("motionSetting", "edit", selectedMotionSetting, currentMotionSetting?.name)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() =>
                        setDeleteDialog({
                          isOpen: true,
                          type: "motionSetting",
                          entityId: selectedMotionSetting,
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Add/Edit Entity Dialog */}
        <AlertDialog open={entityDialogState.isOpen} onOpenChange={(open) => !open && closeEntityDialog()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {entityDialogState.action === "add" ? "Add New" : "Edit"} {entityDialogState.type === "driver" ? "Driver" : entityDialogState.type === "car" ? "Car" : entityDialogState.type === "location" ? "Location" : "Motion Setting"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {entityDialogState.action === "add" ? "Enter a name for the new" : "Update the name of the"} {entityDialogState.type === "driver" ? "driver" : entityDialogState.type === "car" ? "car" : entityDialogState.type === "location" ? "location" : "motion setting"}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="py-4">
              <Input value={entityName} onChange={(e) => setEntityName(e.target.value)} placeholder="Enter name" className={!isNameValid() ? "border-red-500" : ""} />
              {!isNameValid() && (
                <p className="text-sm text-red-500 mt-2">
                  This name already exists
                  {entityDialogState.type === "car" && " for this driver"}
                </p>
              )}
            </div>

            <AlertDialogFooter>
              <Button variant="outline" onClick={closeEntityDialog} disabled={isProcessing}>
                Cancel
              </Button>
              <Button onClick={handleEntitySubmit} disabled={isProcessing || !entityName.trim() || !isNameValid()}>
                {isProcessing ? "Processing..." : "Save"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialog.isOpen} onOpenChange={(open) => !open && setDeleteDialog({ isOpen: false, type: null })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Confirm Deletion
              </AlertDialogTitle>
              <AlertDialogDescription>
                {deleteDialog.type === "driver" ? (
                  <>Are you sure you want to delete driver "{currentDriver?.name}"? This will also delete all their cars and session data.</>
                ) : deleteDialog.type === "car" ? (
                  <>Are you sure you want to delete car "{currentCar?.name}"? This will also delete all associated session data.</>
                ) : deleteDialog.type === "location" ? (
                  <>Are you sure you want to delete location "{currentLocation?.name}"? This will also delete all associated session data.</>
                ) : (
                  <>Are you sure you want to delete this motion setting? This cannot be undone.</>
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
