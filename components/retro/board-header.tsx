"use client";

import {
  Check,
  Clock,
  Copy,
  Eye,
  EyeOff,
  ImageIcon,
  Lock,
  Pencil,
  Settings,
  Share,
  Share2,
  Trash2,
  Unlock,
  Users,
  X,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { UserAccountPopover } from "@/components/auth/user-account-popover";
import { TimerSettings } from "@/components/retro/timer-settings";
import { ThemeToggle } from "@/components/theme-toggle";
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

interface BoardHeaderProps {
  board: RetroBoard;
  currentUserId?: string;
  isAuthor: boolean;
  onDeleteBoard: () => void;
  onSetTimer: (seconds: number) => void;
  onTitleUpdate: (newTitle: string) => void;
  onToggleLock: () => void;
  onToggleSidebar?: () => void;
  onToggleVisibility: () => void;
  participantCount?: number;
  showSidebar?: boolean;
  timerDuration?: number;
}

export function BoardHeader({
  board,
  isAuthor,
  onToggleVisibility,
  onDeleteBoard,
  onSetTimer,
  onTitleUpdate,
  onToggleLock,
  showSidebar,
  onToggleSidebar,
  participantCount = 0,
  currentUserId,
  timerDuration,
}: BoardHeaderProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [remainingTime, setRemainingTime] = useState(
    board.timer_seconds || 300
  );
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(board.title);
  const hasPlayedAlarm = useRef(false);

  useEffect(() => {
    setTitleInput(board.title);
  }, [board.title]);

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

    const updateTimer = () => {
      if (document.hidden) {
        return;
      }
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      const remaining = Math.max(0, targetSeconds - elapsed);
      setRemainingTime(remaining);

      if (remaining === 0 && !hasPlayedAlarm.current) {
        hasPlayedAlarm.current = true;
        playAlarm();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [board.timer_running, board.timer_started_at, board.timer_seconds]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const copyToClipboard = async () => {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    setShareStatus("copied");
    setTimeout(() => setShareStatus(null), 2000);
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `r8ro - ${board.title}`,
          text: `Join my retro session: ${board.title}`,
          url: window.location.href,
        });
        setShareStatus("shared");
        setTimeout(() => setShareStatus(null), 2000);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Share failed:", err);
        }
      }
    } else {
      copyToClipboard();
    }
  };

  const captureAsImage = async () => {
    try {
      setShareStatus("capturing");
      const boardElement = document.querySelector(
        "[data-board-capture]"
      ) as HTMLElement;
      if (!boardElement) {
        return;
      }

      const { default: html2canvas } = await import("html2canvas");

      const canvas = await html2canvas(boardElement, {
        backgroundColor: "#ffffff",
        scale: 2,
        logging: false,
        useCORS: true,
      });

      try {
        canvas.toBlob(async (blob) => {
          if (blob) {
            await navigator.clipboard.write([
              new ClipboardItem({ "image/png": blob }),
            ]);
            setShareStatus("image-copied");
            setTimeout(() => setShareStatus(null), 2000);
          }
        }, "image/png");
      } catch {
        const link = document.createElement("a");
        link.download = `${board.slug}-retro.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        setShareStatus("image-downloaded");
        setTimeout(() => setShareStatus(null), 2000);
      }
    } catch (err) {
      console.error("Capture failed:", err);
      setShareStatus(null);
    }
  };

  const getShareLabel = () => {
    switch (shareStatus) {
      case "copied":
        return "Link Copied!";
      case "shared":
        return "Shared!";
      case "capturing":
        return "Capturing...";
      case "image-copied":
        return "Image Copied!";
      case "image-downloaded":
        return "Downloaded!";
      default:
        return "Share";
    }
  };

  const saveTitle = () => {
    if (titleInput.trim()) {
      onTitleUpdate(titleInput.trim());
      setIsEditingTitle(false);
    }
  };

  const cancelTitleEdit = () => {
    setTitleInput(board.title);
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveTitle();
    }
    if (e.key === "Escape") {
      cancelTitleEdit();
    }
  };

  return (
    <>
      <TooltipProvider>
        <header className="grid grid-cols-1 gap-4 rounded-b-xl border-border border-b-2 bg-background px-3 py-3 shadow-sm md:px-4 lg:grid-cols-[1fr_auto]">
          {/* LEFT SECTION: Branding and Info */}
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="shrink-0 font-black font-mono text-2xl uppercase md:text-3xl">
              r<span className="text-primary">8</span>ro
            </h1>
            <ThemeToggle />
            {currentUserId && <UserAccountPopover variant="compact" />}
            <div className="hidden min-w-0 border-border border-l-2 pl-4 sm:block">
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <Input
                    aria-label="Board title"
                    autoFocus
                    className="h-8 w-48 rounded-lg border border-border font-bold"
                    onChange={(e) => setTitleInput(e.target.value)}
                    onKeyDown={handleTitleKeyDown}
                    value={titleInput}
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        aria-label="Save title"
                        className="h-8 w-8 rounded-lg border border-border bg-foreground p-0 text-background"
                        onClick={saveTitle}
                      >
                        <Check aria-hidden="true" className="h-4 w-4" />
                        <span className="sr-only">Save title</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Save title</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        aria-label="Cancel editing"
                        className="h-8 w-8 rounded-lg border border-border bg-transparent p-0"
                        onClick={cancelTitleEdit}
                        variant="outline"
                      >
                        <X aria-hidden="true" className="h-4 w-4" />
                        <span className="sr-only">Cancel editing</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Cancel</TooltipContent>
                  </Tooltip>
                </div>
              ) : (
                <div className="group flex items-center gap-2">
                  {isAuthor ? (
                    <button
                      className="cursor-pointer font-bold text-lg transition-colors hover:text-primary"
                      onClick={() => setIsEditingTitle(true)}
                      type="button"
                    >
                      {board.title}
                    </button>
                  ) : (
                    <h2 className="font-bold text-lg">{board.title}</h2>
                  )}
                  {isAuthor && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          aria-label="Edit board title"
                          className="h-6 w-6 rounded-lg p-0 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={() => setIsEditingTitle(true)}
                          variant="ghost"
                        >
                          <Pencil aria-hidden="true" className="h-3 w-3" />
                          <span className="sr-only">Edit board title</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Edit title (click or press Enter)
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              )}
              <p className="text-muted-foreground text-sm">{board.slug}</p>
            </div>
          </div>

          {/* RIGHT SECTION: Timer and Actions */}
          <div
            aria-label="Board actions"
            className="flex min-w-0 flex-wrap items-center justify-end gap-2 md:gap-4"
            role="group"
          >
            {/* Timer Display (Read-only) */}
            <div
              aria-label={`Timer: ${formatTime(remainingTime)}`}
              aria-live="polite"
              className={`flex items-center gap-2 rounded-xl border-2 border-border px-3 py-1.5 font-black text-lg shadow-sm md:px-4 md:py-2 md:text-2xl ${
                board.timer_running && remainingTime <= 10
                  ? "animate-pulse bg-primary text-primary-foreground"
                  : board.timer_running
                    ? "bg-chart-4 text-foreground"
                    : "bg-background"
              }`}
              role="timer"
            >
              <Clock aria-hidden="true" className="h-4 w-4 md:h-5 md:w-5" />
              <span>{formatTime(remainingTime)}</span>
            </div>
            {isAuthor && timerDuration !== undefined && (
              <TimerSettings
                duration={timerDuration}
                onDurationChange={onSetTimer}
              />
            )}
            {onToggleSidebar && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-expanded={showSidebar}
                    aria-label={`Participants (${participantCount})`}
                    className="relative h-9 rounded-lg border-2 border-border bg-transparent font-bold shadow-sm md:h-10 xl:hidden"
                    onClick={onToggleSidebar}
                    variant="outline"
                  >
                    <Users aria-hidden="true" className="h-4 w-4 md:mr-2" />
                    <span className="hidden md:inline">Participants</span>
                    {participantCount > 0 && (
                      <span
                        aria-hidden="true"
                        className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-primary font-bold text-primary-foreground text-xs"
                      >
                        {participantCount}
                      </span>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="md:hidden xl:hidden">
                  Participants ({participantCount})
                </TooltipContent>
              </Tooltip>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label="Share options"
                  className="h-9 rounded-lg border-2 border-border bg-transparent font-bold shadow-sm md:h-10"
                  variant="outline"
                >
                  {shareStatus ? (
                    <Check aria-hidden="true" className="h-4 w-4 md:mr-2" />
                  ) : (
                    <Share2 aria-hidden="true" className="h-4 w-4 md:mr-2" />
                  )}
                  <span className="hidden md:inline">{getShareLabel()}</span>
                  <span className="sr-only md:hidden">{getShareLabel()}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="rounded-xl border-2 border-border"
              >
                <DropdownMenuItem onClick={copyToClipboard}>
                  <Copy aria-hidden="true" className="mr-2 h-4 w-4" />
                  Copy Link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={shareNative}>
                  <Share aria-hidden="true" className="mr-2 h-4 w-4" />
                  Share via...
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={captureAsImage}>
                  <ImageIcon aria-hidden="true" className="mr-2 h-4 w-4" />
                  Copy as Image
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {isAuthor && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-haspopup="menu"
                    aria-label="Board management options"
                    className="h-9 rounded-lg border-2 border-border bg-transparent font-bold shadow-sm md:h-10"
                    variant="outline"
                  >
                    <Settings aria-hidden="true" className="h-4 w-4 md:mr-2" />
                    <span className="hidden md:inline">Manage</span>
                    <span className="sr-only md:hidden">Manage board</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="rounded-xl border-2 border-border"
                >
                  <DropdownMenuItem onClick={onToggleVisibility}>
                    {board.is_public ? (
                      <>
                        <EyeOff aria-hidden="true" className="mr-2 h-4 w-4" />
                        Make Private
                      </>
                    ) : (
                      <>
                        <Eye aria-hidden="true" className="mr-2 h-4 w-4" />
                        Make Public
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onToggleLock}>
                    {board.is_locked ? (
                      <>
                        <Unlock aria-hidden="true" className="mr-2 h-4 w-4" />
                        Unlock Board
                      </>
                    ) : (
                      <>
                        <Lock aria-hidden="true" className="mr-2 h-4 w-4" />
                        Lock Board
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-600 focus:bg-red-50 focus:text-red-600"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 aria-hidden="true" className="mr-2 h-4 w-4" />
                    Delete Board
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button
              aria-label={
                board.is_public ? "Board is public" : "Board is private"
              }
              aria-pressed={!board.is_public}
              className={`h-9 rounded-lg border-2 font-bold shadow-sm md:h-10 ${
                board.is_public
                  ? "border-border bg-transparent"
                  : "border-chart-4 bg-chart-4"
              }`}
              variant={board.is_public ? "outline" : "secondary"}
            >
              {board.is_public ? (
                <>
                  <Eye aria-hidden="true" className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Public</span>
                  <span className="sr-only md:hidden">Public board</span>
                </>
              ) : (
                <>
                  <EyeOff aria-hidden="true" className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Private</span>
                  <span className="sr-only md:hidden">Private board</span>
                </>
              )}
            </Button>
          </div>
        </header>
      </TooltipProvider>

      {/* Delete confirmation dialog */}
      <AlertDialog onOpenChange={setShowDeleteDialog} open={showDeleteDialog}>
        <AlertDialogContent
          aria-describedby="delete-dialog-description"
          aria-labelledby="delete-dialog-title"
          className="rounded-2xl border-2 border-border"
          role="alertdialog"
        >
          <AlertDialogHeader>
            <AlertDialogTitle
              className="font-black text-xl uppercase"
              id="delete-dialog-title"
            >
              Delete Board?
            </AlertDialogTitle>
            <AlertDialogDescription id="delete-dialog-description">
              This action cannot be undone. All cards and data will be
              permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-10 rounded-lg border-2 border-border font-bold">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-10 rounded-lg border-2 border-red-600 bg-red-600 font-bold text-white hover:bg-red-700"
              onClick={onDeleteBoard}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
