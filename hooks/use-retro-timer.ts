"use client";

import { useEffect, useRef, useState } from "react";
import type { RetroBoard } from "@/lib/types";

export const DEFAULT_TIMER_SECONDS = 300;

type TimerFields = Pick<
  RetroBoard,
  | "timer_remaining_seconds"
  | "timer_running"
  | "timer_seconds"
  | "timer_started_at"
>;

/** Seconds the countdown starts from: what was left, or the full duration. */
export function getTimerBase(board: TimerFields) {
  return board.timer_remaining_seconds ?? (board.timer_seconds || 0);
}

export function computeRemainingSeconds(board: TimerFields, now = Date.now()) {
  const base = getTimerBase(board);
  if (!(board.timer_running && board.timer_started_at)) {
    return base;
  }
  const startedAt = new Date(board.timer_started_at).getTime();
  const elapsed = Math.floor((now - startedAt) / 1000);
  return Math.max(0, base - Math.max(0, elapsed));
}

export function formatDuration(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function playAlarm() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }
    const context = new AudioContextClass();
    for (const offset of [0, 0.4, 0.8]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.frequency.value = 800;
      oscillator.type = "square";
      gain.gain.setValueAtTime(0.2, context.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(
        0.01,
        context.currentTime + offset + 0.3
      );
      oscillator.start(context.currentTime + offset);
      oscillator.stop(context.currentTime + offset + 0.3);
    }
  } catch (error) {
    console.error("Audio playback failed:", error);
  }
}

/**
 * Ticks the shared retro timer once a second and calls onExpire once when a
 * running countdown reaches zero.
 */
export function useRetroTimer(board: TimerFields, onExpire?: () => void) {
  const [remaining, setRemaining] = useState(() =>
    computeRemainingSeconds(board)
  );
  const hasExpired = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const {
    timer_remaining_seconds,
    timer_running,
    timer_seconds,
    timer_started_at,
  } = board;

  useEffect(() => {
    const fields = {
      timer_remaining_seconds,
      timer_running,
      timer_seconds,
      timer_started_at,
    };
    const tick = () => {
      const value = computeRemainingSeconds(fields);
      setRemaining(value);
      if (timer_running && value === 0 && !hasExpired.current) {
        hasExpired.current = true;
        playAlarm();
        onExpireRef.current?.();
      }
    };

    // A timer that already ran out before this page loaded should not ring.
    hasExpired.current = timer_running && computeRemainingSeconds(fields) === 0;
    tick();

    if (!timer_running) {
      return;
    }
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [timer_remaining_seconds, timer_running, timer_seconds, timer_started_at]);

  return {
    remaining,
    isRunning: timer_running && remaining > 0,
    isExpired: timer_running && remaining === 0,
  };
}
