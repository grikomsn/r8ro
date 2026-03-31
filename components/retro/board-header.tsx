"use client";

import {
  Check,
  Clock,
  Copy,
  Eye,
  EyeOff,
  ImageIcon,
  Lock,
  Menu,
  Pencil,
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
        return "Capturing…";
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
        <header className="flex flex-col gap-2 rounded-b-xl border-border border-b-2 bg-background px-3 py-2 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3 md:px-4 md:py-3 lg:gap-4">
          {/* LEFT SECTION: Branding and Info */}
          <div className="flex min-w-0 items-center gap-2 md:gap-3">
            <h1 className="shrink-0 font-black font-mono text-xl uppercase md:text-2xl lg:text-3xl">
              r<span className="text-primary">8</span>ro
            </h1>
            <ThemeToggle />
            {currentUserId && <UserAccountPopover variant="compact" />}
            <div className="min-w-0 border-border border-l-2 pl-3 md:pl-4">
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <Input
                    aria-label="Board title"
                    autoComplete="off"
                    autoFocus
                    className="h-8 w-40 rounded-lg border border-border font-bold md:w-48"
                    name="boardTitle"
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
                      className="cursor-pointer truncate font-bold text-base transition-colors hover:text-primary md:text-lg"
                      onClick={() => setIsEditingTitle(true)}
                      type="button"
                    >
                      {board.title}
                    </button>
                  ) : (
                    <h2 className="truncate font-bold text-base md:text-lg">
                      {board.title}
                    </h2>
                  )}
                  {isAuthor && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          aria-label="Edit board title"
                          className="h-6 w-6 rounded-lg p-0 opacity-0 transition-opacity focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
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
              <p className="truncate text-muted-foreground text-xs md:text-sm">
                {board.slug}
              </p>
            </div>
          </div>

          {/* RIGHT SECTION: Timer and Actions */}
          <div
            aria-label="Board actions"
            className="flex flex-wrap items-center gap-1.5 sm:gap-2 md:gap-3"
            role="group"
          >
            {/* Timer Display - Always prominent */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  aria-label={`Timer: ${formatTime(remainingTime)}`}
                  className={`flex shrink-0 items-center gap-1 rounded-lg border-2 border-border px-2 py-1 font-black text-sm shadow-sm sm:gap-1.5 sm:px-3 sm:text-base md:py-1.5 md:text-lg lg:px-4 lg:text-xl xl:text-2xl ${
                    board.timer_running && remainingTime <= 10
                      ? "animate-pulse bg-primary text-primary-foreground"
                      : board.timer_running
                        ? "bg-chart-4 text-foreground"
                        : "bg-background"
                  }`}
                  role="timer"
                >
                  <Clock
                    aria-hidden="true"
                    className="h-3.5 w-3.5 sm:h-4 sm:w-4 lg:h-5 lg:w-5"
                  />
                  <span>{formatTime(remainingTime)}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="lg:hidden">
                {board.timer_running ? "Timer running" : "Timer paused"}
              </TooltipContent>
            </Tooltip>

            {/* Timer Settings for Author */}
            {isAuthor && timerDuration !== undefined && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label="Timer settings"
                    className="h-8 rounded-lg border-2 border-border bg-transparent p-0 font-bold shadow-sm sm:h-9 lg:h-10 lg:px-3"
                    onClick={() => {
                      const durations = [60, 180, 300, 600, 900];
                      const currentIndex = durations.indexOf(timerDuration);
                      const nextDuration =
                        durations[(currentIndex + 1) % durations.length];
                      onSetTimer(nextDuration);
                    }}
                    variant="outline"
                  >
                    <Clock aria-hidden="true" className="h-4 w-4 lg:mr-2" />
                    <span className="hidden lg:inline">
                      {Math.floor(timerDuration / 60)}m
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="lg:hidden">
                  Timer: {Math.floor(timerDuration / 60)} minutes
                </TooltipContent>
              </Tooltip>
            )}

            {/* Participants Toggle */}
            {onToggleSidebar && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-expanded={showSidebar}
                    aria-label={`Participants (${participantCount})`}
                    className="relative h-8 rounded-lg border-2 border-border bg-transparent p-0 font-bold shadow-sm sm:h-9 lg:h-10 lg:px-3 xl:hidden"
                    onClick={onToggleSidebar}
                    variant="outline"
                  >
                    <Users aria-hidden="true" className="h-4 w-4 lg:mr-2" />
                    <span className="hidden lg:inline">Participants</span>
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
                <TooltipContent className="lg:hidden">
                  Participants ({participantCount})
                </TooltipContent>
              </Tooltip>
            )}

            {/* Share Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label="Share options"
                  className="h-8 rounded-lg border-2 border-border bg-transparent p-0 font-bold shadow-sm sm:h-9 lg:h-10 lg:px-3"
                  variant="outline"
                >
                  {shareStatus ? (
                    <Check aria-hidden="true" className="h-4 w-4 lg:mr-2" />
                  ) : (
                    <Share2 aria-hidden="true" className="h-4 w-4 lg:mr-2" />
                  )}
                  <span className="hidden lg:inline">{getShareLabel()}</span>
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
                  Share via…
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={captureAsImage}>
                  <ImageIcon aria-hidden="true" className="mr-2 h-4 w-4" />
                  Copy as Image
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Author "More" Menu */}
            {isAuthor && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-haspopup="menu"
                    aria-label="More options"
                    className="h-8 rounded-lg border-2 border-border bg-transparent p-0 font-bold shadow-sm sm:h-9 lg:h-10 lg:px-3"
                    variant="outline"
                  >
                    <Menu aria-hidden="true" className="h-4 w-4 lg:mr-2" />
                    <span className="hidden lg:inline">More</span>
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
                    className="text-destructive focus-visible:bg-destructive/10 focus-visible:text-destructive"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 aria-hidden="true" className="mr-2 h-4 w-4" />
                    Delete Board
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Visibility Indicator - Always Visible */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label={
                    board.is_public ? "Board is public" : "Board is private"
                  }
                  aria-pressed={!board.is_public}
                  className={`h-8 rounded-lg border-2 p-0 font-bold shadow-sm sm:h-9 lg:h-10 lg:px-3 ${
                    board.is_public
                      ? "border-border bg-transparent"
                      : "border-chart-4 bg-chart-4"
                  }`}
                  variant={board.is_public ? "outline" : "secondary"}
                >
                  {board.is_public ? (
                    <Eye aria-hidden="true" className="h-4 w-4 lg:mr-2" />
                  ) : (
                    <EyeOff aria-hidden="true" className="h-4 w-4 lg:mr-2" />
                  )}
                  <span className="hidden lg:inline">
                    {board.is_public ? "Public" : "Private"}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent className="lg:hidden">
                {board.is_public ? "Public board" : "Private board"}
              </TooltipContent>
            </Tooltip>
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
              className="h-10 rounded-lg border-2 border-destructive bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90"
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
