import React, { useState } from "react";
import { AlertCircle, Save, RotateCw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

const PiConfiguration = () => {
  const [settings, setSettings] = useState({
    deviceName: "",
    userPassword: "",
    wifiName: "",
    wifiPassword: "",
    applicationUrl: "",
  });

  const [status, setStatus] = useState({
    isLoading: false,
    error: "",
    success: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateSettings = () => {
    if (settings.deviceName && !/^[a-zA-Z0-9-]+$/.test(settings.deviceName)) {
      throw new Error("Device name can only contain letters, numbers, and hyphens");
    }
    if (settings.wifiName && !/^[a-zA-Z0-9-]+$/.test(settings.wifiName)) {
      throw new Error("WiFi name can only contain letters, numbers, and hyphens");
    }
    if (settings.wifiPassword && settings.wifiPassword.length < 8) {
      throw new Error("WiFi password must be at least 8 characters long");
    }
    if (settings.userPassword && settings.userPassword.length < 8) {
      throw new Error("User password must be at least 8 characters long");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ isLoading: true, error: "", success: "" });

    try {
      validateSettings();

      const response = await fetch("/api/system", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setStatus({
        isLoading: false,
        error: "",
        success: "Settings updated successfully. System will reboot in 10 seconds.",
      });

      // Wait for reboot
      setTimeout(() => {
        window.location.href = settings.applicationUrl || window.location.href;
      }, 10000);
    } catch (error) {
      setStatus({
        isLoading: false,
        error: error.message,
        success: "",
      });
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>System Configuration</CardTitle>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {status.error && (
            <AlertDialog>
              <AlertDialogTitle>Error</AlertDialogTitle>
              <AlertDialogContent>{status.error}</AlertDialogContent>
            </AlertDialog>
          )}

          {status.success && (
            <Alert className="bg-green-50 text-green-900 border-green-200">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>{status.success}</AlertDescription>
            </Alert>
          )}

          {/* Device Name */}
          <div className="space-y-2">
            <Label htmlFor="deviceName">Device Name</Label>
            <Input id="deviceName" name="deviceName" placeholder="rclaptimer" value={settings.deviceName} onChange={handleChange} />
          </div>

          {/* User Password */}
          <div className="space-y-2">
            <Label htmlFor="userPassword">Pi User Password</Label>
            <Input id="userPassword" name="userPassword" type="password" placeholder="Enter new password" value={settings.userPassword} onChange={handleChange} />
          </div>

          {/* WiFi Name */}
          <div className="space-y-2">
            <Label htmlFor="wifiName">WiFi Network Name</Label>
            <Input id="wifiName" name="wifiName" placeholder="rc-lap-timer" value={settings.wifiName} onChange={handleChange} />
          </div>

          {/* WiFi Password */}
          <div className="space-y-2">
            <Label htmlFor="wifiPassword">WiFi Password</Label>
            <Input id="wifiPassword" name="wifiPassword" type="password" placeholder="Enter new WiFi password" value={settings.wifiPassword} onChange={handleChange} />
          </div>
        </CardContent>

        {/* Save Button */}
        <CardFooter className="flex justify-end space-x-4">
          <Button type="submit" disabled={status.isLoading} className="bg-blue-600 hover:bg-blue-700">
            {status.isLoading ? (
              <>
                <RotateCw className="mr-2 h-4 w-4 animate-spin" />
                Saving & Rebooting...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save & Reboot                
              </>              
            )}
          </Button>

          
        </CardFooter>
      </form>
    </Card>
  );
};

export default PiConfiguration;
