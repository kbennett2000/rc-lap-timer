import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  User,
  Car as CarIcon,
  Pencil,
  Trash2,
  AlertTriangle,
  Map,
  SlidersHorizontal,
  Users,
  Cog,
  Wrench,
} from "lucide-react";
import PiConfiguration from "@/components/pi-config-settings";
import {
  errorMessage,
  useAppData,
  useCreateCar,
  useCreateDriver,
  useCreateLocation,
  useDeleteCar,
  useDeleteDriver,
  useDeleteLocation,
  useDeleteMotionSettings,
  useMotionSettings,
  useRenameDriver,
  useRenameLocation,
  useUpdateCar,
  useUpdateMotionSettings,
} from "@/data/hooks";
import { sameName } from "@/domain/rules";
import { gridCols } from "@/lib/utils";
import { CAPABILITIES } from "@/platform/capabilities";
import TrackMeasurer from "./track-measurer";

// Drivers & Cars, Locations, Motion Settings, Utilities, and System Settings on the Pi.
const TAB_COUNT = CAPABILITIES.piSystemConfig ? 5 : 4;
// A car's default number is for IR timing, in practice and races.
const SHOW_CAR_NUMBER = CAPABILITIES.irTiming || CAPABILITIES.races;

type EntityType = "driver" | "car" | "location" | "motionSetting";
type ActionType = "add" | "edit";

interface EntityDialogState {
  isOpen: boolean;
  type: EntityType | null;
  action: ActionType | null;
  entityId?: string;
  initialValue?: string;
  initialCarNumber?: number;
}

// Drivers, cars, locations and saved motion settings, plus the utilities and (on the Pi) system settings.
const DriverCarManager: React.FC = () => {
  const { drivers, locations } = useAppData();
  const motionSettings = useMotionSettings();
  const createDriver = useCreateDriver();
  const renameDriver = useRenameDriver();
  const deleteDriver = useDeleteDriver();
  const createCar = useCreateCar();
  const updateCar = useUpdateCar();
  const deleteCar = useDeleteCar();
  const createLocation = useCreateLocation();
  const renameLocation = useRenameLocation();
  const deleteLocation = useDeleteLocation();
  const updateMotionSettings = useUpdateMotionSettings();
  const deleteMotionSettings = useDeleteMotionSettings();

  // Selection states
  const [selectedDriver, setSelectedDriver] = useState<string>("");
  const [selectedCar, setSelectedCar] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [selectedMotionSetting, setSelectedMotionSetting] = useState<string>("");

  // Entity management states
  const [isProcessing, setIsProcessing] = useState(false);
  const [entityDialogState, setEntityDialogState] = useState<EntityDialogState>({
    isOpen: false,
    type: null,
    action: null,
  });
  const [entityName, setEntityName] = useState("");
  const [defaultCarNumber, setDefaultCarNumber] = useState<number | undefined>(undefined);

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

  const openEntityDialog = (
    type: EntityType,
    action: ActionType,
    entityId?: string,
    initialValue: string = "",
    initialCarNumber?: number,
  ) => {
    setEntityDialogState({
      isOpen: true,
      type,
      action,
      entityId,
      initialValue,
      initialCarNumber,
    });
    setEntityName(initialValue);
    setDefaultCarNumber(initialCarNumber);
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
    const name = entityName.trim();
    if (!type || !action || !name) return;

    setIsProcessing(true);
    try {
      const carNumber = defaultCarNumber ?? null;
      if (action === "add") {
        if (type === "driver") setSelectedDriver((await createDriver.mutateAsync(name)).id);
        else if (type === "car") {
          const car = await createCar.mutateAsync({ driverId: selectedDriver, name, defaultCarNumber: carNumber });
          setSelectedCar(car.id);
        } else if (type === "location") setSelectedLocation((await createLocation.mutateAsync(name)).id);
      } else if (entityId) {
        if (type === "driver") await renameDriver.mutateAsync({ id: entityId, name });
        else if (type === "car") {
          await updateCar.mutateAsync({ id: entityId, changes: { name, defaultCarNumber: carNumber } });
        } else if (type === "location") await renameLocation.mutateAsync({ id: entityId, name });
        else if (currentMotionSetting) {
          const { sensitivity, threshold, cooldown, framesToSkip } = currentMotionSetting;
          const input = { name, sensitivity, threshold, cooldown, framesToSkip };
          await updateMotionSettings.mutateAsync({ id: entityId, input });
        }
      }
      closeEntityDialog();
    } catch (error) {
      alert(errorMessage(error));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    const { type } = deleteDialog;
    if (!type) return;

    setIsProcessing(true);
    try {
      if (type === "driver") {
        await deleteDriver.mutateAsync(selectedDriver);
        setSelectedDriver("");
        setSelectedCar("");
      } else if (type === "car") {
        await deleteCar.mutateAsync(selectedCar);
        setSelectedCar("");
      } else if (type === "location") {
        await deleteLocation.mutateAsync(selectedLocation);
        setSelectedLocation("");
      } else {
        await deleteMotionSettings.mutateAsync(selectedMotionSetting);
        setSelectedMotionSetting("");
      }
    } catch (error) {
      alert(`Failed to delete. ${errorMessage(error)}`);
    } finally {
      setIsProcessing(false);
      setDeleteDialog({ isOpen: false, type: null });
    }
  };

  // Names are unique ignoring case (car names per driver); a record may keep its own name.
  const isNameValid = () => {
    const { type, entityId } = entityDialogState;
    const taken = (items: { id: string; name: string }[]) =>
      items.some((item) => item.id !== entityId && sameName(item.name, entityName));
    switch (type) {
      case "driver":
        return !taken(drivers);
      case "car":
        return !taken(currentDriver?.cars ?? []);
      case "location":
        return !taken(locations);
      case "motionSetting":
        return !taken(motionSettings);
      default:
        return true;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Application Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="drivers">
          <TabsList className={`grid w-full h-full ${gridCols(TAB_COUNT)}`}>
            <TabsTrigger value="drivers">
              <div className="flex flex-col items-center">
                <Users className="h-6 w-6" />
                <span className="text-xs mt-1">
                  Drivers <br />& Cars
                </span>
              </div>
            </TabsTrigger>

            <TabsTrigger value="locations">
              <div className="flex flex-col items-center">
                <Map className="h-6 w-6" />
                <span className="text-xs mt-1">Locations</span>
              </div>
            </TabsTrigger>

            <TabsTrigger value="motionSettings">
              <div className="flex flex-col items-center">
                <SlidersHorizontal className="h-6 w-6" />
                <span className="text-xs mt-1">
                  Motion <br />
                  Settings
                </span>
              </div>
            </TabsTrigger>

            <TabsTrigger value="utilities">
              <div className="flex flex-col items-center">
                <Wrench className="h-6 w-6" />
                <span className="text-xs mt-1">Utilities</span>
              </div>
            </TabsTrigger>

            {CAPABILITIES.piSystemConfig && (
              <TabsTrigger value="systemSettings">
                <div className="flex flex-col items-center">
                  <Cog className="h-6 w-6" />
                  <span className="text-xs mt-1">
                    System <br />
                    Settings
                  </span>
                </div>
              </TabsTrigger>
            )}
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
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Edit driver"
                      onClick={() =>
                        openEntityDialog("driver", "edit", selectedDriver, currentDriver?.name || "", undefined)
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="destructive"
                      size="icon"
                      aria-label="Delete driver"
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

              <Button variant="outline" onClick={() => openEntityDialog("driver", "add", undefined, "", undefined)}>
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
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Edit car"
                          onClick={() =>
                            openEntityDialog(
                              "car",
                              "edit",
                              selectedCar,
                              currentCar?.name || "",
                              currentCar?.defaultCarNumber ?? undefined,
                            )
                          }
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          aria-label="Delete car"
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
                <Button variant="outline" onClick={() => openEntityDialog("car", "add", undefined, "", undefined)}>
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
                    {[...locations]
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
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Edit location"
                      onClick={() =>
                        openEntityDialog("location", "edit", selectedLocation, currentLocation?.name || "", undefined)
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="destructive"
                      size="icon"
                      aria-label="Delete location"
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

              <Button variant="outline" onClick={() => openEntityDialog("location", "add", undefined, "", undefined)}>
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
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Edit motion setting"
                      onClick={() =>
                        openEntityDialog("motionSetting", "edit", selectedMotionSetting, currentMotionSetting?.name)
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      aria-label="Delete motion setting"
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

          {/* Utilities Tab */}
          <TabsContent value="utilities" className="space-y-4">
            <div className="space-y-2">
              {/* Track Measurer */}
              <TrackMeasurer />
            </div>
          </TabsContent>

          {/* System Settings Tab */}
          {CAPABILITIES.piSystemConfig && (
            <TabsContent value="systemSettings" className="space-y-4">
              <div className="space-y-2">
                <PiConfiguration />
              </div>
            </TabsContent>
          )}
        </Tabs>

        {/* Add/Edit Entity Dialog */}
        <AlertDialog open={entityDialogState.isOpen} onOpenChange={(open) => !open && closeEntityDialog()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {entityDialogState.action === "add" ? "Add New" : "Edit"}{" "}
                {entityDialogState.type === "driver"
                  ? "Driver"
                  : entityDialogState.type === "car"
                    ? "Car"
                    : entityDialogState.type === "location"
                      ? "Location"
                      : "Motion Setting"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {entityDialogState.action === "add" ? "Enter a name for the new" : "Update the name of the"}{" "}
                {entityDialogState.type === "driver"
                  ? "driver"
                  : entityDialogState.type === "car"
                    ? "car"
                    : entityDialogState.type === "location"
                      ? "location"
                      : "motion setting"}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="py-4">
              <Input
                value={entityName}
                onChange={(e) => setEntityName(e.target.value)}
                placeholder="Enter name"
                className={!isNameValid() ? "border-red-500" : ""}
              />
              {!isNameValid() && (
                <p className="text-sm text-red-500 mt-2">
                  This name already exists
                  {entityDialogState.type === "car" && " for this driver"}
                </p>
              )}
            </div>

            <div className="py-4">
              {/* Car Number Input for Cars */}
              {entityDialogState.type === "car" && SHOW_CAR_NUMBER && (
                <div className="space-y-2">
                  <Label>Default IR Car Number (Optional)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="8"
                    value={defaultCarNumber || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "") {
                        setDefaultCarNumber(undefined);
                      } else {
                        const num = parseInt(value);
                        if (num >= 1 && num <= 8) {
                          setDefaultCarNumber(num);
                        }
                      }
                    }}
                    placeholder="Enter default car number (1-8)"
                  />
                  <p className="text-sm text-gray-500">Enter a number between 1-8 to set as default for IR timing</p>
                </div>
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
        <AlertDialog
          open={deleteDialog.isOpen}
          onOpenChange={(open) => !open && setDeleteDialog({ isOpen: false, type: null })}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Confirm Deletion
              </AlertDialogTitle>
              <AlertDialogDescription>
                {deleteDialog.type === "driver" ? (
                  <>
                    Are you sure you want to delete driver &ldquo;{currentDriver?.name}&rdquo;? This will also delete
                    all their cars, sessions and race results.
                  </>
                ) : deleteDialog.type === "car" ? (
                  <>
                    Are you sure you want to delete car &ldquo;{currentCar?.name}&rdquo;? This will also delete its
                    sessions and race results.
                  </>
                ) : deleteDialog.type === "location" ? (
                  <>
                    Are you sure you want to delete location &ldquo;{currentLocation?.name}&rdquo;? This will also
                    delete all sessions and races at this location.
                  </>
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
