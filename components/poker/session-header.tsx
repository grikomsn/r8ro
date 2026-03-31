"use client";

import {
  Check,
  Copy,
  Eye,
  EyeOff,
  ImageIcon,
  Menu,
  Pencil,
  Share,
  Share2,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { UserAccountPopover } from "@/components/auth/user-account-popover";
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
import {
  VOTING_SCALES,
  type VotingScaleType,
} from "@/lib/constants/poker-scales";
import type { PokerSession } from "@/lib/types";

interface SessionHeaderProps {
  currentUserId?: string;
  isAuthor: boolean;
  onDeleteSession: () => void;
  onStoryUpdate: (story: string) => void;
  onTitleUpdate: (newTitle: string) => void;
  onToggleSidebar?: () => void;
  onToggleVisibility: () => void;
  onUpdateScale: (scale: string[]) => void;
  participantCount?: number;
  session: PokerSession;
  showSidebar?: boolean;
}

export function SessionHeader({
  session,
  isAuthor,
  onToggleVisibility,
  onDeleteSession,
  onTitleUpdate,
  onStoryUpdate,
  onUpdateScale,
  showSidebar,
  onToggleSidebar,
  participantCount = 0,
  currentUserId,
}: SessionHeaderProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(session.title);
  const [isEditingStory, setIsEditingStory] = useState(false);
  const [storyInput, setStoryInput] = useState(session.current_story || "");

  useEffect(() => {
    setTitleInput(session.title);
  }, [session.title]);

  useEffect(() => {
    setStoryInput(session.current_story || "");
  }, [session.current_story]);

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
          title: `r8ro - ${session.title}`,
          text: `Join my poker session: ${session.title}`,
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
      const sessionElement = document.querySelector(
        "[data-session-capture]"
      ) as HTMLElement;
      if (!sessionElement) {
        return;
      }

      const { default: html2canvas } = await import("html2canvas");

      const canvas = await html2canvas(sessionElement, {
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
        link.download = `${session.slug}-poker.png`;
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
    setTitleInput(session.title);
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

  const saveStory = () => {
    onStoryUpdate(storyInput.trim());
    setIsEditingStory(false);
  };

  const cancelStoryEdit = () => {
    setStoryInput(session.current_story || "");
    setIsEditingStory(false);
  };

  const handleStoryKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveStory();
    }
    if (e.key === "Escape") {
      cancelStoryEdit();
    }
  };

  const handleScaleChange = (scaleType: VotingScaleType) => {
    onUpdateScale([...VOTING_SCALES[scaleType]]);
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
            {currentUserId && <UserAccountPopover variant="compact" />}
            <div className="min-w-0 border-border border-l-2 pl-3 md:pl-4">
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <Input
                    aria-label="Session title"
                    autoComplete="off"
                    autoFocus
                    className="h-8 w-40 rounded-lg border border-border font-bold md:w-48"
                    name="sessionTitle"
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
                      {session.title}
                    </button>
                  ) : (
                    <h2 className="truncate font-bold text-base md:text-lg">
                      {session.title}
                    </h2>
                  )}
                  {isAuthor && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          aria-label="Edit session title"
                          className="h-6 w-6 rounded-lg p-0 opacity-0 transition-opacity focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
                          onClick={() => setIsEditingTitle(true)}
                          variant="ghost"
                        >
                          <Pencil aria-hidden="true" className="h-3 w-3" />
                          <span className="sr-only">Edit session title</span>
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
                {session.slug}
              </p>
            </div>
          </div>

          {/* RIGHT SECTION: Current Story and Actions */}
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2 md:gap-3">
            {/* Current Story - Prominent on all sizes */}
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-initial">
              {isEditingStory ? (
                <div className="flex flex-1 items-center gap-2 sm:flex-initial">
                  <Input
                    aria-label="Current story"
                    autoComplete="off"
                    autoFocus
                    className="h-8 min-w-0 flex-1 rounded-lg border border-border font-bold text-sm sm:w-48 sm:flex-initial md:h-9 md:w-64"
                    name="currentStory"
                    onChange={(e) => setStoryInput(e.target.value)}
                    onKeyDown={handleStoryKeyDown}
                    placeholder="Enter story…"
                    value={storyInput}
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        aria-label="Save story"
                        className="h-8 w-8 shrink-0 rounded-lg border border-border bg-foreground p-0 text-background"
                        onClick={saveStory}
                      >
                        <Check aria-hidden="true" className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Save story</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        aria-label="Cancel editing"
                        className="h-8 w-8 shrink-0 rounded-lg border border-border bg-transparent p-0"
                        onClick={cancelStoryEdit}
                        variant="outline"
                      >
                        <X aria-hidden="true" className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Cancel</TooltipContent>
                  </Tooltip>
                </div>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="group flex min-w-0 flex-1 items-center gap-2 sm:flex-initial">
                      {session.current_story ? (
                        isAuthor ? (
                          <button
                            className="cursor-pointer truncate font-bold text-base transition-colors hover:text-primary md:text-lg"
                            onClick={() => setIsEditingStory(true)}
                            type="button"
                          >
                            {session.current_story}
                          </button>
                        ) : (
                          <h2 className="truncate font-bold text-base md:text-lg">
                            {session.current_story}
                          </h2>
                        )
                      ) : (
                        <button
                          className={`truncate font-bold text-base text-muted-foreground transition-colors hover:text-primary md:text-lg ${isAuthor ? "cursor-pointer" : "cursor-default"}`}
                          onClick={() => isAuthor && setIsEditingStory(true)}
                          type="button"
                        >
                          {isAuthor ? "Add story…" : "No story"}
                        </button>
                      )}
                      {isAuthor && (
                        <Button
                          aria-label="Edit story"
                          className="h-6 w-6 shrink-0 rounded-lg p-0 opacity-0 transition-opacity focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
                          onClick={() => setIsEditingStory(true)}
                          variant="ghost"
                        >
                          <Pencil aria-hidden="true" className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {session.current_story ||
                      (isAuthor ? "Click to add story" : "No story set")}
                  </TooltipContent>
                </Tooltip>
              )}
              {participantCount > 0 && (
                <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-muted px-2 py-1">
                  <Users className="h-4 w-4" />
                  <span className="font-bold text-sm">{participantCount}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div
              aria-label="Session actions"
              className="flex flex-wrap items-center gap-1.5 sm:gap-2"
              role="group"
            >
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

              {/* Author "More" Menu with Scale Changer */}
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                          <Sparkles
                            aria-hidden="true"
                            className="mr-2 h-4 w-4"
                          />
                          Change Scale
                        </DropdownMenuItem>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="rounded-xl border-2 border-border">
                        <DropdownMenuItem
                          onClick={() => handleScaleChange("fibonacci")}
                        >
                          Fibonacci
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleScaleChange("tshirt")}
                        >
                          T-shirt
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleScaleChange("linear")}
                        >
                          Linear
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onToggleVisibility}>
                      {session.is_public ? (
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
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus-visible:bg-destructive/10 focus-visible:text-destructive"
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      <Trash2 aria-hidden="true" className="mr-2 h-4 w-4" />
                      Delete Session
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Visibility Indicator - Always Visible */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={
                      session.is_public
                        ? "Session is public"
                        : "Session is private"
                    }
                    aria-pressed={!session.is_public}
                    className={`h-8 rounded-lg border-2 p-0 font-bold shadow-sm sm:h-9 lg:h-10 lg:px-3 ${
                      session.is_public
                        ? "border-border bg-transparent"
                        : "border-chart-4 bg-chart-4"
                    }`}
                    variant={session.is_public ? "outline" : "secondary"}
                  >
                    {session.is_public ? (
                      <Eye aria-hidden="true" className="h-4 w-4 lg:mr-2" />
                    ) : (
                      <EyeOff aria-hidden="true" className="h-4 w-4 lg:mr-2" />
                    )}
                    <span className="hidden lg:inline">
                      {session.is_public ? "Public" : "Private"}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="lg:hidden">
                  {session.is_public ? "Public session" : "Private session"}
                </TooltipContent>
              </Tooltip>
            </div>
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
              Delete Session?
            </AlertDialogTitle>
            <AlertDialogDescription id="delete-dialog-description">
              This action cannot be undone. All votes and data will be
              permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-10 rounded-lg border-2 border-border font-bold">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-10 rounded-lg border-2 border-destructive bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90"
              onClick={onDeleteSession}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
