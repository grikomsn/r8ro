"use client";

import type React from "react";
import { UserAccountPopover } from "@/components/auth/user-account-popover";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  TooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PokerSession } from "@/lib/types";
import {
  Play,
  Pause,
  Eye,
  EyeOff,
  Trash2,
  Share2,
  Settings,
  Check,
  Pencil,
  X,
  Copy,
  ImageIcon,
  Share,
  Users,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import html2canvas from "html2canvas";
import {
  VOTING_SCALES,
  type VotingScaleType,
} from "@/lib/constants/poker-scales";

interface SessionHeaderProps {
  session: PokerSession;
  isAuthor: boolean;
  onToggleVisibility: () => void;
  onToggleVoting: () => void;
  onToggleReveal: () => void;
  onClearVotes: () => void;
  onDeleteSession: () => void;
  onTitleUpdate: (newTitle: string) => void;
  onStoryUpdate: (story: string) => void;
  onUpdateScale: (scale: string[]) => void;
  showSidebar?: boolean;
  onToggleSidebar?: () => void;
  participantCount?: number;
  currentUserId?: string;
}

export function SessionHeader({
  session,
  isAuthor,
  onToggleVisibility,
  onToggleVoting,
  onToggleReveal,
  onClearVotes,
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
  const [copied, setCopied] = useState(false);
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
          console.log("[v0] Share failed:", err);
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
        "[role='main']"
      ) as HTMLElement;
      if (!sessionElement) {
        console.log("[v0] Session element not found");
        return;
      }

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
      console.log("[v0] Capture failed:", err);
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
            <div className="hidden border-l-2 border-border pl-4 sm:block">
              {isEditingTitle ? (
                <div
                  className="flex items-center gap-2"
                  role="form"
                  aria-label="Edit session title"
                >
                  <Input
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    onKeyDown={handleTitleKeyDown}
                    className="h-8 w-48 border border-border font-bold rounded-lg"
                    autoFocus
                    aria-label="Session title"
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
                  <h1
                    className={`text-lg font-bold ${isAuthor ? "cursor-pointer hover:text-primary transition-colors" : ""}`}
                    onClick={() => isAuthor && setIsEditingTitle(true)}
                  >
                    {session.title}
                  </h1>
                  {isAuthor && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          onClick={() => setIsEditingTitle(true)}
                          className="h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100 rounded-lg"
                          aria-label="Edit session title"
                        >
                          <Pencil className="h-3 w-3" aria-hidden="true" />
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
              <p className="text-sm text-muted-foreground">{session.slug}</p>
            </div>
          </div>

          {/* CENTER SECTION: Current Story */}
          <div className="flex items-center justify-center gap-2">
            {isEditingStory ? (
              <div className="flex items-center gap-2">
                <Input
                  value={storyInput}
                  onChange={(e) => setStoryInput(e.target.value)}
                  onKeyDown={handleStoryKeyDown}
                  placeholder="Enter story/task name"
                  className="h-10 w-64 border border-border font-bold rounded-lg"
                  autoFocus
                  aria-label="Current story"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={saveStory}
                      className="h-10 w-10 p-0 border border-border bg-foreground text-background rounded-lg"
                      aria-label="Save story"
                    >
                      <Check className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Save story</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      onClick={cancelStoryEdit}
                      className="h-10 w-10 p-0 border border-border bg-transparent rounded-lg"
                      aria-label="Cancel editing"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Cancel</TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <div className="group flex items-center gap-2">
                {session.current_story ? (
                  <h2
                    className={`text-lg font-bold ${isAuthor ? "cursor-pointer hover:text-primary transition-colors" : ""}`}
                    onClick={() => isAuthor && setIsEditingStory(true)}
                  >
                    {session.current_story}
                  </h2>
                ) : (
                  <button
                    onClick={() => isAuthor && setIsEditingStory(true)}
                    className={`text-lg font-bold text-muted-foreground hover:text-primary transition-colors ${isAuthor ? "cursor-pointer" : "cursor-default"}`}
                  >
                    {isAuthor ? "Click to add story..." : "No story set"}
                  </button>
                )}
                {isAuthor && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        onClick={() => setIsEditingStory(true)}
                        className="h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100 rounded-lg"
                        aria-label="Edit story"
                      >
                        <Pencil className="h-3 w-3" aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit story</TooltipContent>
                  </Tooltip>
                )}
              </div>
            )}
            {participantCount > 0 && (
              <div className="flex items-center gap-1 border border-border px-2 py-1 rounded-lg bg-muted">
                <Users className="h-4 w-4" />
                <span className="text-sm font-bold">{participantCount}</span>
              </div>
            )}
          </div>

          {/* RIGHT SECTION: Actions */}
          <div
            className="flex items-center justify-end gap-2"
            role="group"
            aria-label="Session actions"
          >
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
                <TooltipContent className="xl:hidden">
                  Participants ({participantCount})
                </TooltipContent>
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
              <DropdownMenuContent
                className="border-2 border-border rounded-xl"
                align="end"
              >
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
                    aria-label="Session management options"
                    aria-haspopup="menu"
                  >
                    <Settings className="h-4 w-4 md:mr-2" aria-hidden="true" />
                    <span className="hidden md:inline">Manage</span>
                    <span className="sr-only md:hidden">Manage session</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="border-2 border-border rounded-xl"
                  align="end"
                >
                  <DropdownMenuItem onClick={onToggleVoting}>
                    {session.is_voting_active ? (
                      <>
                        <Pause className="mr-2 h-4 w-4" aria-hidden="true" />
                        Stop Voting
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" aria-hidden="true" />
                        Start Voting
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onToggleReveal}>
                    {session.votes_revealed ? (
                      <>
                        <EyeOff className="mr-2 h-4 w-4" aria-hidden="true" />
                        Hide Cards
                      </>
                    ) : (
                      <>
                        <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
                        Reveal Cards
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onClearVotes}>
                    <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                    Clear Votes
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
                        Change Scale
                      </DropdownMenuItem>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="border-2 border-border rounded-xl">
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
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                  >
                    <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                    Delete Session
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button
              variant={session.is_public ? "outline" : "secondary"}
              className={`h-9 border-2 font-bold shadow-sm md:h-10 rounded-lg ${
                session.is_public
                  ? "border-border bg-transparent"
                  : "border-chart-4 bg-chart-4"
              }`}
              aria-label={
                session.is_public ? "Session is public" : "Session is private"
              }
              aria-pressed={!session.is_public}
            >
              {session.is_public ? (
                <>
                  <Eye className="h-4 w-4 md:mr-2" aria-hidden="true" />
                  <span className="hidden md:inline">Public</span>
                  <span className="sr-only md:hidden">Public session</span>
                </>
              ) : (
                <>
                  <EyeOff className="h-4 w-4 md:mr-2" aria-hidden="true" />
                  <span className="hidden md:inline">Private</span>
                  <span className="sr-only md:hidden">Private session</span>
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
            <AlertDialogTitle
              id="delete-dialog-title"
              className="text-xl font-black uppercase"
            >
              Delete Session?
            </AlertDialogTitle>
            <AlertDialogDescription id="delete-dialog-description">
              This action cannot be undone. All votes and data will be
              permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-10 border-2 border-border font-bold rounded-lg">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeleteSession}
              className="h-10 border-2 border-red-600 bg-red-600 font-bold text-white hover:bg-red-700 rounded-lg"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
