"use client";

import { Clock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface TimerSettingsProps {
  className?: string;
  duration: number;
  onDurationChange: (seconds: number) => void;
}

const PRESET_OPTIONS = [
  { label: "1 minute", seconds: 60 },
  { label: "3 minutes", seconds: 180 },
  { label: "5 minutes", seconds: 300 },
  { label: "10 minutes", seconds: 600 },
  { label: "15 minutes", seconds: 900 },
  { label: "30 minutes", seconds: 1800 },
];

export function TimerSettings({
  duration,
  onDurationChange,
  className,
}: TimerSettingsProps) {
  const [open, setOpen] = useState(false);
  const [localDuration, setLocalDuration] = useState(duration);

  const handleSave = () => {
    onDurationChange(localDuration);
    setOpen(false);
  };

  const handleCancel = () => {
    setLocalDuration(duration);
    setOpen(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSliderChange = (value: number[]) => {
    setLocalDuration(value[0]);
  };

  return (
    <Dialog
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (isOpen) {
          setLocalDuration(duration);
        }
      }}
      open={open}
    >
      <DialogTrigger asChild>
        <Button className={cn("gap-2", className)} variant="outline">
          <Clock className="h-4 w-4" />
          <span className="hidden sm:inline">Timer Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Timer Settings
          </DialogTitle>
          <DialogDescription>
            Configure the default timer duration for your retro board.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm" id="duration-label">
                Duration
              </span>
              <span className="font-bold font-mono text-lg text-primary">
                {formatTime(localDuration)}
              </span>
            </div>
            <Slider
              aria-labelledby="duration-label"
              aria-valuemax={1800}
              aria-valuemin={60}
              aria-valuenow={localDuration}
              aria-valuetext={formatTime(localDuration)}
              className="py-2"
              max={1800}
              min={60}
              onValueChange={handleSliderChange}
              step={30}
              value={[localDuration]}
            />
            <div className="flex justify-between text-muted-foreground text-xs">
              <span>1:00</span>
              <span>30:00</span>
            </div>
          </div>

          <div className="space-y-2">
            <span className="font-medium text-sm" id="presets-label">
              Quick Presets
            </span>
            <div
              aria-labelledby="presets-label"
              className="grid grid-cols-3 gap-2"
              role="group"
            >
              {PRESET_OPTIONS.map((option) => (
                <Button
                  className={cn(
                    "text-xs",
                    localDuration === option.seconds
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-muted hover:bg-muted/80"
                  )}
                  key={option.seconds}
                  onClick={() => setLocalDuration(option.seconds)}
                  variant="secondary"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button onClick={handleCancel} variant="outline">
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Settings</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
