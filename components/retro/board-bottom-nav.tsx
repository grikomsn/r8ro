"use client";

import { Clock, Pause, Play, RotateCcw, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { RetroBoard } from "@/lib/types";

interface BoardBottomNavProps {
  board: RetroBoard;
  isAuthor: boolean;
  onTimerToggle: () => void;
  onTimerReset: () => void;
  onSetTimer: (seconds: number) => void;
}

export function BoardBottomNav({
  board,
  isAuthor,
  onTimerToggle,
  onTimerReset,
  onSetTimer,
}: BoardBottomNavProps) {
  const [_remainingTime, setRemainingTime] = useState(
    board.timer_seconds || 300
  );
  const [timerInput, setTimerInput] = useState("");
  const hasPlayedAlarm = useRef(false);

  useEffect(() => {
    if (!board.timer_running) {
      setRemainingTime(board.timer_seconds || 300);
      hasPlayedAlarm.current = false;
    }
  }, [board.timer_seconds, board.timer_running]);

  useEffect(() => {
    const playAlarm = () => {
      try {
        const AudioContextClass =
          window.AudioContext ||
          ("webkitAudioContext" in window
            ? (window as unknown as { webkitAudioContext: typeof AudioContext })
                .webkitAudioContext
            : undefined);
        if (AudioContextClass) {
          const audioContext = new AudioContextClass();

          const playBeep = (time: number) => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = "square";

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + time);
            gainNode.gain.exponentialRampToValueAtTime(
              0.01,
              audioContext.currentTime + time + 0.3
            );

            oscillator.start(audioContext.currentTime + time);
            oscillator.stop(audioContext.currentTime + time + 0.3);
          };

          playBeep(0);
          playBeep(0.4);
          playBeep(0.8);
        }
      } catch (e) {
        console.error("Audio playback failed:", e);
      }
    };

    if (!(board.timer_running && board.timer_started_at)) {
      return;
    }

    const startTime = new Date(board.timer_started_at).getTime();
    const targetSeconds = board.timer_seconds || 300;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      const remaining = Math.max(0, targetSeconds - elapsed);
      setRemainingTime(remaining);

      if (remaining === 0 && !hasPlayedAlarm.current) {
        hasPlayedAlarm.current = true;
        playAlarm();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [board.timer_running, board.timer_started_at, board.timer_seconds]);

  const handleSetTimer = () => {
    const minutes = Number.parseInt(timerInput, 10);
    if (!Number.isNaN(minutes) && minutes > 0) {
      onSetTimer(minutes * 60);
      setTimerInput("");
    }
  };

  const handleTimerReset = () => {
    hasPlayedAlarm.current = false;
    onTimerReset();
  };

  if (!isAuthor) {
    return null;
  }

  return (
    <TooltipProvider>
      <nav
        aria-label="Timer controls"
        className="fixed bottom-4 left-1/2 z-50 flex h-16 -translate-x-1/2 items-center justify-center gap-2 rounded-xl border-2 border-border bg-background/80 px-4 shadow-lg backdrop-blur-md md:h-20 md:px-6"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={board.timer_running ? "Pause timer" : "Start timer"}
              aria-pressed={board.timer_running}
              className="h-10 w-10 rounded-lg border-2 border-border bg-transparent p-0 shadow-sm"
              onClick={onTimerToggle}
              variant="outline"
            >
              {board.timer_running ? (
                <Pause aria-hidden="true" className="h-4 w-4" />
              ) : (
                <Play aria-hidden="true" className="h-4 w-4" />
              )}
              <span className="sr-only">
                {board.timer_running ? "Pause timer" : "Start timer"}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {board.timer_running ? "Pause timer" : "Start timer"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label="Reset timer"
              className="h-10 w-10 rounded-lg border-2 border-border bg-transparent p-0 shadow-sm"
              onClick={handleTimerReset}
              variant="outline"
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              <span className="sr-only">Reset timer</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reset timer</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label="Timer settings"
                  className="h-10 w-10 rounded-lg border-2 border-border bg-transparent p-0 shadow-sm"
                  variant="outline"
                >
                  <Settings aria-hidden="true" className="h-4 w-4" />
                  <span className="sr-only">Timer settings</span>
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Timer settings</TooltipContent>
          </Tooltip>
          <DropdownMenuContent
            align="center"
            className="w-64 rounded-xl border-2 border-border"
            sideOffset={12}
          >
            <div className="space-y-3 p-4">
              <p
                className="mb-2 font-bold text-xs uppercase"
                id="timer-input-label"
              >
                Set Timer (minutes)
              </p>
              <div className="flex gap-2">
                <Input
                  aria-labelledby="timer-input-label"
                  className="w-20 rounded-lg border border-border"
                  min="1"
                  onChange={(e) => setTimerInput(e.target.value)}
                  placeholder="5"
                  type="number"
                  value={timerInput}
                />
                <Button
                  className="h-10 rounded-lg border border-border bg-accent font-bold text-accent-foreground"
                  onClick={handleSetTimer}
                >
                  Set
                </Button>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="font-bold"
              onClick={() => onSetTimer(5 * 60)}
            >
              <Clock className="mr-2 h-4 w-4" />5 minutes (default)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSetTimer(10 * 60)}>
              <Clock className="mr-2 h-4 w-4" />
              10 minutes
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSetTimer(15 * 60)}>
              <Clock className="mr-2 h-4 w-4" />
              15 minutes
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </TooltipProvider>
  );
}
