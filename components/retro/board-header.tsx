"use client"

import type React from "react"
import { UserAccountPopover } from "@/components/auth/user-account-popover"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { RetroBoard } from "@/lib/types"
import {
  Play,
  Pause,
  RotateCcw,
  Eye,
  EyeOff,
  Trash2,
  Share2,
  Settings,
  Clock,
  Check,
  Pencil,
  X,
  Lock,
  Unlock,
  Copy,
  ImageIcon,
  Share,
  Users,
} from "lucide-react"
import html2canvas from "html2canvas"

interface BoardHeaderProps {
  board: RetroBoard
  isAuthor: boolean
  onToggleVisibility: () => void
  onDeleteBoard: () => void
  onTimerToggle: () => void
  onTimerReset: () => void
  onSetTimer: (seconds: number) => void
  onTitleUpdate: (newTitle: string) => void
  onToggleLock: () => void
  showSidebar?: boolean
  onToggleSidebar?: () => void
  participantCount?: number
  currentUserId?: string
}

export function BoardHeader({
  board,
  isAuthor,
  onToggleVisibility,
  onDeleteBoard,
  onTimerToggle,
  onTimerReset,
  onSetTimer,
  onTitleUpdate,
  onToggleLock,
  showSidebar,
  onToggleSidebar,
  participantCount = 0,
  currentUserId,
}: BoardHeaderProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [remainingTime, setRemainingTime] = useState(board.timer_seconds || 300)
  const [copied, setCopied] = useState(false)
  const [shareStatus, setShareStatus] = useState<string | null>(null)
  const [timerInput, setTimerInput] = useState("")
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleInput, setTitleInput] = useState(board.title)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const hasPlayedAlarm = useRef(false)

  useEffect(() => {
    setTitleInput(board.title)
  }, [board.title])

  useEffect(() => {
    if (!board.timer_running) {
      setRemainingTime(board.timer_seconds || 300)
      hasPlayedAlarm.current = false
    }
  }, [board.timer_seconds, board.timer_running])

  useEffect(() => {
    if (!board.timer_running || !board.timer_started_at) {
      return
    }

    const startTime = new Date(board.timer_started_at).getTime()
    const targetSeconds = board.timer_seconds || 300

    const interval = setInterval(() => {
      const now = Date.now()
      const elapsed = Math.floor((now - startTime) / 1000)
      const remaining = Math.max(0, targetSeconds - elapsed)
      setRemainingTime(remaining)

      if (remaining === 0 && !hasPlayedAlarm.current) {
        hasPlayedAlarm.current = true
        playAlarm()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [board.timer_running, board.timer_started_at, board.timer_seconds])

  const playAlarm = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

      const playBeep = (time: number) => {
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        oscillator.frequency.value = 800
        oscillator.type = "square"

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + time)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + time + 0.3)

        oscillator.start(audioContext.currentTime + time)
        oscillator.stop(audioContext.currentTime + time + 0.3)
      }

      playBeep(0)
      playBeep(0.4)
      playBeep(0.8)
    } catch (e) {
      console.log("[v0] Audio playback failed:", e)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const copyToClipboard = async () => {
    const url = window.location.href
    await navigator.clipboard.writeText(url)
    setShareStatus("copied")
    setTimeout(() => setShareStatus(null), 2000)
  }

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `r8ro - ${board.title}`,
          text: `Join my retro session: ${board.title}`,
          url: window.location.href,
        })
        setShareStatus("shared")
        setTimeout(() => setShareStatus(null), 2000)
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.log("[v0] Share failed:", err)
        }
      }
    } else {
      copyToClipboard()
    }
  }

  const captureAsImage = async () => {
    try {
      setShareStatus("capturing")
      const boardElement = document.querySelector("[data-board-capture]") as HTMLElement
      if (!boardElement) {
        console.log("[v0] Board element not found")
        return
      }

      const canvas = await html2canvas(boardElement, {
        backgroundColor: "#ffffff",
        scale: 2,
        logging: false,
        useCORS: true,
      })

      try {
        canvas.toBlob(async (blob) => {
          if (blob) {
            await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
            setShareStatus("image-copied")
            setTimeout(() => setShareStatus(null), 2000)
          }
        }, "image/png")
      } catch {
        const link = document.createElement("a")
        link.download = `${board.slug}-retro.png`
        link.href = canvas.toDataURL("image/png")
        link.click()
        setShareStatus("image-downloaded")
        setTimeout(() => setShareStatus(null), 2000)
      }
    } catch (err) {
      console.log("[v0] Capture failed:", err)
      setShareStatus(null)
    }
  }

  const getShareLabel = () => {
    switch (shareStatus) {
      case "copied":
        return "Link Copied!"
      case "shared":
        return "Shared!"
      case "capturing":
        return "Capturing..."
      case "image-copied":
        return "Image Copied!"
      case "image-downloaded":
        return "Downloaded!"
      default:
        return "Share"
    }
  }

  const handleSetTimer = () => {
    const minutes = Number.parseInt(timerInput)
    if (!isNaN(minutes) && minutes > 0) {
      onSetTimer(minutes * 60)
      setTimerInput("")
    }
  }

  const saveTitle = () => {
    if (titleInput.trim()) {
      onTitleUpdate(titleInput.trim())
      setIsEditingTitle(false)
    }
  }

  const cancelTitleEdit = () => {
    setTitleInput(board.title)
    setIsEditingTitle(false)
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveTitle()
    }
    if (e.key === "Escape") {
      cancelTitleEdit()
    }
  }

  const handleTimerReset = () => {
    hasPlayedAlarm.current = false
    onTimerReset()
  }

  return (
    <>
      <TooltipProvider>
        <header
          className="grid grid-cols-1 gap-4 rounded-t-xl border-b-2 border-border bg-background px-4 py-4 shadow-sm md:grid-cols-[1fr_auto_1fr] md:px-6"
          role="banner"
        >
          {/* LEFT SECTION: Branding and Info */}
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black uppercase md:text-3xl font-mono">
              r<span className="text-primary">8</span>ro
            </h1>
            {currentUserId && <UserAccountPopover variant="compact" />}
            <div className="hidden border-l-2 border-border pl-4 lg:block">
              {isEditingTitle ? (
                <div className="flex items-center gap-2" role="form" aria-label="Edit board title">
                  <Input
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    onKeyDown={handleTitleKeyDown}
                    className="h-8 w-48 border border-border font-bold rounded-lg"
                    autoFocus
                    aria-label="Board title"
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={saveTitle}
                        className="h-8 w-8 p-0 border border-border bg-foreground text-background rounded-lg"
                        aria-label="Save title"
                      >
                        <Check className="h-4 w-4" aria-hidden="true" />
                        <span className="sr-only">Save title</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Save title</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        onClick={cancelTitleEdit}
                        className="h-8 w-8 p-0 border border-border bg-transparent rounded-lg"
                        aria-label="Cancel editing"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                        <span className="sr-only">Cancel editing</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Cancel</TooltipContent>
                  </Tooltip>
                </div>
              ) : (
                <div className="group flex items-center gap-2">
                  <h1 className="text-lg font-bold">{board.title}</h1>
                  {isAuthor && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          onClick={() => setIsEditingTitle(true)}
                          className="h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100 rounded-lg"
                          aria-label="Edit board title"
                        >
                          <Pencil className="h-3 w-3" aria-hidden="true" />
                          <span className="sr-only">Edit board title</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit title</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              )}
              <p className="text-sm text-muted-foreground">{board.slug}</p>
            </div>
          </div>

          {/* CENTER SECTION: Timer and Controls */}
          <div className="flex items-center justify-center gap-2">
            <div
              className={`flex items-center gap-2 border-2 border-border px-4 py-2 text-2xl font-black shadow-sm rounded-xl ${
                board.timer_running && remainingTime <= 10
                  ? "animate-pulse bg-primary text-primary-foreground"
                  : board.timer_running
                    ? "bg-chart-4 text-foreground"
                    : "bg-background"
              }`}
              role="timer"
              aria-label={`Timer: ${formatTime(remainingTime)}`}
              aria-live="polite"
            >
              <Clock className="h-5 w-5" aria-hidden="true" />
              <span>{formatTime(remainingTime)}</span>
            </div>

            {isAuthor && (
              <div className="flex gap-1" role="group" aria-label="Timer controls">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      onClick={onTimerToggle}
                      className="h-10 w-10 p-0 border-2 border-border shadow-sm bg-transparent rounded-lg"
                      aria-label={board.timer_running ? "Pause timer" : "Start timer"}
                      aria-pressed={board.timer_running}
                    >
                      {board.timer_running ? (
                        <Pause className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Play className="h-4 w-4" aria-hidden="true" />
                      )}
                      <span className="sr-only">{board.timer_running ? "Pause timer" : "Start timer"}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{board.timer_running ? "Pause timer" : "Start timer"}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      onClick={handleTimerReset}
                      className="hidden h-10 w-10 p-0 border-2 border-border shadow-sm bg-transparent sm:flex rounded-lg"
                      aria-label="Reset timer"
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
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
                          variant="outline"
                          className="hidden h-10 w-10 p-0 border-2 border-border shadow-sm bg-transparent sm:flex rounded-lg"
                          aria-label="Timer settings"
                        >
                          <Settings className="h-4 w-4" aria-hidden="true" />
                          <span className="sr-only">Timer settings</span>
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Timer settings</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent
                    className="border-2 border-border rounded-xl w-64"
                    align="center"
                    sideOffset={12}
                  >
                    <div className="p-4 space-y-3">
                      <p className="mb-2 text-xs font-bold uppercase" id="timer-input-label">
                        Set Timer (minutes)
                      </p>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="5"
                          value={timerInput}
                          onChange={(e) => setTimerInput(e.target.value)}
                          className="w-20 border border-border rounded-lg"
                          aria-labelledby="timer-input-label"
                          min="1"
                        />
                        <Button
                          onClick={handleSetTimer}
                          className="h-10 border border-border bg-accent font-bold text-accent-foreground rounded-lg"
                        >
                          Set
                        </Button>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onSetTimer(5 * 60)} className="font-bold">
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
              </div>
            )}
          </div>

          {/* RIGHT SECTION: Actions */}
          <div className="flex items-center justify-end gap-2" role="group" aria-label="Board actions">
            {onToggleSidebar && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={onToggleSidebar}
                    className="relative h-9 border-2 border-border font-bold shadow-sm bg-transparent xl:hidden md:h-10 rounded-lg"
                    aria-label={`Participants (${participantCount})`}
                    aria-expanded={showSidebar}
                  >
                    <Users className="h-4 w-4 md:mr-2" aria-hidden="true" />
                    <span className="hidden md:inline">Participants</span>
                    {participantCount > 0 && (
                      <span
                        className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center border border-border bg-primary text-xs font-bold text-primary-foreground rounded-full"
                        aria-hidden="true"
                      >
                        {participantCount}
                      </span>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="xl:hidden">Participants ({participantCount})</TooltipContent>
              </Tooltip>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  onClick={() => {}}
                  className="h-9 border-2 border-border font-bold shadow-sm bg-transparent md:h-10 rounded-lg"
                  aria-label="Share options"
                >
                  {shareStatus ? (
                    <Check className="h-4 w-4 md:mr-2" aria-hidden="true" />
                  ) : (
                    <Share2 className="h-4 w-4 md:mr-2" aria-hidden="true" />
                  )}
                  <span className="hidden md:inline">{getShareLabel()}</span>
                  <span className="sr-only md:hidden">{getShareLabel()}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="border-2 border-border rounded-xl" align="end">
                <DropdownMenuItem onClick={copyToClipboard}>
                  <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                  Copy Link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={shareNative}>
                  <Share className="mr-2 h-4 w-4" aria-hidden="true" />
                  Share via...
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={captureAsImage}>
                  <ImageIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                  Copy as Image
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {isAuthor && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-9 border-2 border-border font-bold shadow-sm bg-transparent md:h-10 rounded-lg"
                    aria-label="Board management options"
                    aria-haspopup="menu"
                  >
                    <Settings className="h-4 w-4 md:mr-2" aria-hidden="true" />
                    <span className="hidden md:inline">Manage</span>
                    <span className="sr-only md:hidden">Manage board</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="border-2 border-border rounded-xl" align="end">
                  <DropdownMenuItem onClick={onToggleVisibility}>
                    {board.is_public ? (
                      <>
                        <EyeOff className="mr-2 h-4 w-4" aria-hidden="true" />
                        Make Private
                      </>
                    ) : (
                      <>
                        <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
                        Make Public
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onToggleLock}>
                    {board.is_locked ? (
                      <>
                        <Unlock className="mr-2 h-4 w-4" aria-hidden="true" />
                        Unlock Board
                      </>
                    ) : (
                      <>
                        <Lock className="mr-2 h-4 w-4" aria-hidden="true" />
                        Lock Board
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                  >
                    <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                    Delete Board
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button
              variant={board.is_public ? "outline" : "secondary"}
              className={`h-9 border-2 font-bold shadow-sm md:h-10 rounded-lg ${
                board.is_public ? "border-border bg-transparent" : "border-chart-4 bg-chart-4"
              }`}
              aria-label={board.is_public ? "Board is public" : "Board is private"}
              aria-pressed={!board.is_public}
            >
              {board.is_public ? (
                <>
                  <Eye className="h-4 w-4 md:mr-2" aria-hidden="true" />
                  <span className="hidden md:inline">Public</span>
                  <span className="sr-only md:hidden">Public board</span>
                </>
              ) : (
                <>
                  <EyeOff className="h-4 w-4 md:mr-2" aria-hidden="true" />
                  <span className="hidden md:inline">Private</span>
                  <span className="sr-only md:hidden">Private board</span>
                </>
              )}
            </Button>
          </div>
        </header>
      </TooltipProvider>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent
          className="border-2 border-border rounded-2xl"
          role="alertdialog"
          aria-labelledby="delete-dialog-title"
          aria-describedby="delete-dialog-description"
        >
          <AlertDialogHeader>
            <AlertDialogTitle id="delete-dialog-title" className="text-xl font-black uppercase">
              Delete Board?
            </AlertDialogTitle>
            <AlertDialogDescription id="delete-dialog-description">
              This action cannot be undone. All cards and data will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-10 border-2 border-border font-bold rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeleteBoard}
              className="h-10 border-2 border-red-600 bg-red-600 font-bold text-white hover:bg-red-700 rounded-lg"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
