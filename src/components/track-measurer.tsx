import React, { useState, useEffect } from "react";
import { MapPin, Navigation2, AlertCircle, Settings2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const TrackMeasurer = () => {
  const DEFAULT_DISTANCE = 132;
  const [startPosition, setStartPosition] = useState(null);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [distance, setDistance] = useState(0);
  const [heading, setHeading] = useState(0);
  const [error, setError] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState("prompt");
  const [targetDistance, setTargetDistance] = useState(DEFAULT_DISTANCE);

  const [distanceDialogOpen, setDistanceDialogOpen] = useState(false);
  const [tempDistance, setTempDistance] = useState(DEFAULT_DISTANCE);

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 20902231; // Earth radius in feet
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Check and request permissions
  useEffect(() => {
    const checkPermissions = async () => {
      if (!("permissions" in navigator)) {
        setError("Geolocation not supported in this browser");
        return;
      }

      try {
        const permission = await navigator.permissions.query({ name: "geolocation" });
        setPermissionStatus(permission.state);

        permission.addEventListener("change", (e) => {
          setPermissionStatus(e.target.state);
        });
      } catch (err) {
        setError("Error checking location permissions");
        console.error("Permission error:", err);
      }
    };

    checkPermissions();
  }, []);

  const handleStartPosition = () => {
    setError(null);

    if (!("geolocation" in navigator)) {
      setError("Geolocation not supported");
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0,
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setStartPosition({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (err) => {
        console.error("Error getting start position:", err);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError("Location permission denied");
            break;
          case err.POSITION_UNAVAILABLE:
            setError("Location information unavailable");
            break;
          case err.TIMEOUT:
            setError("Location request timed out");
            break;
          default:
            setError("Error getting location");
        }
      },
      options
    );
  };

  // Watch position changes
  useEffect(() => {
    let watchId;

    if (startPosition && "geolocation" in navigator) {
      const options = {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      };

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const current = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
          setCurrentPosition(current);

          const dist = calculateDistance(startPosition.lat, startPosition.lon, current.lat, current.lon);
          setDistance(dist);

          // Calculate heading
          const dLon = ((current.lon - startPosition.lon) * Math.PI) / 180;
          const y = Math.sin(dLon) * Math.cos((current.lat * Math.PI) / 180);
          const x = Math.cos((startPosition.lat * Math.PI) / 180) * Math.sin((current.lat * Math.PI) / 180) - Math.sin((startPosition.lat * Math.PI) / 180) * Math.cos((current.lat * Math.PI) / 180) * Math.cos(dLon);
          const brng = (Math.atan2(y, x) * 180) / Math.PI;
          setHeading((brng + 360) % 360);
        },
        (err) => {
          console.error("Error watching position:", err);
          switch (err.code) {
            case err.PERMISSION_DENIED:
              setError("Location permission denied");
              break;
            case err.POSITION_UNAVAILABLE:
              setError("Location information unavailable");
              break;
            case err.TIMEOUT:
              setError("Location request timed out");
              break;
            default:
              setError("Error tracking location");
          }
        },
        options
      );
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [startPosition]);

  // Reset everything
  const handleReset = () => {
    setStartPosition(null);
    setCurrentPosition(null);
    setDistance(0);
    setHeading(0);
    setError(null);
  };

  const handleDistanceSubmit = (e) => {
    e.preventDefault();
    const newDistance = parseFloat(tempDistance);
    if (!isNaN(newDistance) && newDistance > 0) {
      setTargetDistance(newDistance);
      setDialogOpen(false);
    } else {
      setError("Please enter a valid distance");
    }
  };

  const handleDistanceReset = () => {
    setTempDistance(DEFAULT_DISTANCE);
    setTargetDistance(DEFAULT_DISTANCE);
    setDialogOpen(false);
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>RC Track Measurer</CardTitle>
          <AlertDialog open={distanceDialogOpen} onOpenChange={setDistanceDialogOpen}>
            {/* Add this AlertDialogTrigger */}
            <Button variant="ghost" size="icon" onClick={() => setDistanceDialogOpen(true)} className="h-8 w-8 p-0">
              <Settings2 className="h-4 w-4" />
            </Button>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Change Target Distance</AlertDialogTitle>
                <AlertDialogDescription>Enter a new target distance in feet. Default is 132 feet.</AlertDialogDescription>
              </AlertDialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="distance">Target Distance (feet)</Label>
                  <Input id="distance" type="number" step="0.1" value={tempDistance} onChange={(e) => setTempDistance(parseFloat(e.target.value))} />
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={() => {
                    setTempDistance(DEFAULT_DISTANCE);
                    setDistanceDialogOpen(false);
                  }}
                >
                  Reset to Default
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (!isNaN(tempDistance) && tempDistance > 0) {
                      setTargetDistance(tempDistance);
                      setDistanceDialogOpen(false);
                    }
                  }}
                >
                  Save Changes
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col items-center gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {permissionStatus === "denied" ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Please enable location services in your device settings to use this feature.</AlertDescription>
            </Alert>
          ) : (
            <>
              {!startPosition ? (
                <button onClick={handleStartPosition} className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg">
                  <MapPin size={20} />
                  Mark Start Line
                </button>
              ) : (
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center text-4xl">
                    <Navigation2 size={48} style={{ transform: `rotate(${heading}deg)` }} className="text-blue-500" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-2xl font-bold">{distance.toFixed(1)} ft</p>
                    {currentPosition && <p className="text-sm text-gray-500">Accuracy: ±{currentPosition.accuracy.toFixed(1)}ft</p>}
                    <p className={`text-lg ${Math.abs(distance - targetDistance) < 1 ? "text-green-500" : ""}`}>{distance < targetDistance ? `Keep walking: ${(targetDistance - distance).toFixed(1)} ft to go` : `Too far: ${(distance - targetDistance).toFixed(1)} ft past`}</p>
                    <button onClick={handleReset} className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg">
                      Reset
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TrackMeasurer;
