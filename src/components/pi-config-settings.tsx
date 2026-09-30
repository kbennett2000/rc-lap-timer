import React, { useState } from "react";
import { Save, RotateCw } from "lucide-react";
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
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { validateSystemSettings } from "@/lib/system-settings";

const RELOAD_AFTER_REBOOT_MS = 60_000;

type Settings = {
  adminPin: string;
  deviceName: string;
  userPassword: string;
  wifiName: string;
  wifiPassword: string;
};

const EMPTY_SETTINGS: Settings = { adminPin: "", deviceName: "", userPassword: "", wifiName: "", wifiPassword: "" };

function validateSettings(settings: Settings): string | null {
  if (!settings.adminPin) return "Enter the admin PIN.";
  return validateSystemSettings(settings);
}

const PiConfiguration = () => {
  const [settings, setSettings] = useState<Settings>(EMPTY_SETTINGS);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [status, setStatus] = useState({ isLoading: false, error: "", success: "" });

  const hasChanges = Boolean(
    settings.deviceName || settings.userPassword || settings.wifiName || settings.wifiPassword,
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validationError = validateSettings(settings);
    if (validationError) {
      setStatus({ isLoading: false, error: validationError, success: "" });
      return;
    }
    setStatus({ isLoading: false, error: "", success: "" });
    setConfirmOpen(true);
  };

  const applySettings = async () => {
    setConfirmOpen(false);
    setStatus({ isLoading: true, error: "", success: "" });

    try {
      const response = await fetch("/api/system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const applied =
          Array.isArray(data.applied) && data.applied.length > 0 ? ` Already applied: ${data.applied.join(", ")}.` : "";
        throw new Error((data.error || `Request failed (${response.status}).`) + applied);
      }

      setSettings(EMPTY_SETTINGS);
      setStatus({
        isLoading: false,
        error: "",
        success:
          "Settings updated. The Pi is rebooting; reconnect to its Wi-Fi if needed. This page reloads in about a minute.",
      });
      setTimeout(() => window.location.reload(), RELOAD_AFTER_REBOOT_MS);
    } catch (err) {
      setStatus({ isLoading: false, error: err instanceof Error ? err.message : String(err), success: "" });
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
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{status.error}</AlertDescription>
            </Alert>
          )}

          {status.success && (
            <Alert className="bg-green-50 text-green-900 border-green-200">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>{status.success}</AlertDescription>
            </Alert>
          )}

          {/* Admin PIN */}
          <div className="space-y-2">
            <Label htmlFor="adminPin">Admin PIN</Label>
            <Input
              id="adminPin"
              name="adminPin"
              type="password"
              autoComplete="off"
              placeholder="Set as ADMIN_PIN on the Pi"
              value={settings.adminPin}
              onChange={handleChange}
            />
          </div>

          {/* Device Name */}
          <div className="space-y-2">
            <Label htmlFor="deviceName">Device Name</Label>
            <Input
              id="deviceName"
              name="deviceName"
              placeholder="rclaptimer"
              value={settings.deviceName}
              onChange={handleChange}
            />
          </div>

          {/* User Password */}
          <div className="space-y-2">
            <Label htmlFor="userPassword">Pi User Password</Label>
            <Input
              id="userPassword"
              name="userPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Enter new password"
              value={settings.userPassword}
              onChange={handleChange}
            />
          </div>

          {/* TODO: Uncomment to enable changes to WiFi Network name and password - this will break the Remote LED device - see issue #12 */}
          {/* WiFi Name */}
          {/*
          <div className="space-y-2">
            <Label htmlFor="wifiName">WiFi Network Name</Label>
            <Input id="wifiName" name="wifiName" placeholder="rc-lap-timer" value={settings.wifiName} onChange={handleChange} />
          </div>
          */}

          {/* WiFi Password */}
          {/*
          <div className="space-y-2">
            <Label htmlFor="wifiPassword">WiFi Password</Label>
            <Input id="wifiPassword" name="wifiPassword" type="password" placeholder="Enter new WiFi password" value={settings.wifiPassword} onChange={handleChange} />
          </div>
          */}
        </CardContent>

        {/* Save Button */}
        <CardFooter className="flex justify-end space-x-4">
          <Button type="submit" disabled={status.isLoading || !hasChanges} className="bg-blue-600 hover:bg-blue-700">
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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save and reboot?</AlertDialogTitle>
            <AlertDialogDescription>
              The Pi reboots right after saving. Any session running on a connected device will be interrupted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={applySettings}>Save & Reboot</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default PiConfiguration;
