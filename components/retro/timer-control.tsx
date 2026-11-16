"use client";

import { Clock, Pause, Play, RotateCcw } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDuration, useRetroTimer } from "@/hooks/use-retro-timer";
import type { RetroBoard } from "@/lib/types";
import { cn } from "@/lib/utils";

const PRESET_MINUTES = [1, 3, 5, 10, 15];
const MAX_MINUTES = 180;

interface TimerControlProps {
  board: RetroBoard;
  canControl: boolean;
  onExpire?: () => void;
  onReset: () => void;
  onSetDuration: (seconds: number) => void;
  onToggle: () => void;
}

export function TimerControl({
  board,
  canControl,
  onExpire,
  onReset,
  onSetDuration,
  onToggle,
}: TimerControlProps) {
  const { remaining, isExpired } = useRetroTimer(board, onExpire);
  const [customMinutes, setCustomMinutes] = useState("");

  const isPaused =
    !board.timer_running && board.timer_remaining_seconds !== null;
  const isRunning = board.timer_running && !isExpired;
  const status = isExpired
    ? "Time's up"
    : isRunning
      ? "Running"
      : isPaused
        ? "Paused"
        : "Ready";

  const display = (
    <span
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border-2 px-2 font-black font-mono text-sm tabular-nums sm:px-2.5 sm:text-base",
        isExpired
          ? "animate-pulse border-destructive bg-destructive text-destructive-foreground"
          : isRunning && remaining <= 30
            ? "border-primary bg-primary text-primary-foreground"
            : isRunning
              ? "border-primary bg-primary/15"
              : "border-border bg-background"
      )}
    >
      <Clock aria-hidden="true" className="h-4 w-4 max-sm:hidden" />
      {formatDuration(remaining)}
      {isPaused && (
        <Pause aria-hidden="true" className="h-3.5 w-3.5 opacity-70" />
      )}
    </span>
  );

  const label = `Timer ${formatDuration(remaining)}, ${status.toLowerCase()}`;

  if (!canControl) {
    return (
      <div aria-label={label} role="timer" title={status}>
        {display}
      </div>
    );
  }

  const setCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const minutes = Number.parseInt(customMinutes, 10);
    if (Number.isFinite(minutes) && minutes > 0 && minutes <= MAX_MINUTES) {
      onSetDuration(minutes * 60);
      setCustomMinutes("");
    }
  };

  const durationMinutes = Math.round(board.timer_seconds / 60);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label={`${label}. Open timer controls`}
          className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          type="button"
        >
          {display}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 rounded-xl border-2 p-4">
        <div className="flex items-baseline justify-between">
          <p className="font-black font-mono text-3xl tabular-nums">
            {formatDuration(remaining)}
          </p>
          <p className="font-bold text-muted-foreground text-xs uppercase">
            {status}
          </p>
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            className="h-10 flex-1 rounded-lg font-bold"
            disabled={isExpired}
            onClick={onToggle}
          >
            {board.timer_running ? (
              <>
                <Pause aria-hidden="true" className="mr-1.5 h-4 w-4" /> Pause
              </>
            ) : (
              <>
                <Play aria-hidden="true" className="mr-1.5 h-4 w-4" />
                {isPaused ? "Resume" : "Start"}
              </>
            )}
          </Button>
          <Button
            className="h-10 rounded-lg font-bold"
            onClick={onReset}
            variant="outline"
          >
            <RotateCcw aria-hidden="true" className="mr-1.5 h-4 w-4" /> Reset
          </Button>
        </div>

        <p className="mt-4 mb-2 font-bold text-muted-foreground text-xs uppercase">
          Duration · {durationMinutes} min
        </p>
        <div className="grid grid-cols-5 gap-1.5">
          {PRESET_MINUTES.map((minutes) => (
            <Button
              aria-pressed={board.timer_seconds === minutes * 60}
              className={cn(
                "h-9 rounded-lg px-0 font-bold",
                board.timer_seconds === minutes * 60 &&
                  "border-primary bg-primary/15"
              )}
              key={minutes}
              onClick={() => onSetDuration(minutes * 60)}
              variant="outline"
            >
              {minutes}m
            </Button>
          ))}
        </div>
        <form className="mt-2 flex gap-2" onSubmit={setCustom}>
          <Input
            aria-label="Custom duration in minutes"
            className="h-9 rounded-lg"
            inputMode="numeric"
            max={MAX_MINUTES}
            min={1}
            onChange={(e) => setCustomMinutes(e.target.value)}
            placeholder="Custom minutes"
            type="number"
            value={customMinutes}
          />
          <Button className="h-9 rounded-lg" type="submit" variant="secondary">
            Set
          </Button>
        </form>
        <p className="mt-3 text-muted-foreground text-xs">
          Changing the duration resets the timer for everyone.
        </p>
      </PopoverContent>
    </Popover>
  );
}
