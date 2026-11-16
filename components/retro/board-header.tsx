"use client";

import {
  ClipboardCopy,
  Download,
  Globe,
  Lock,
  LockOpen,
  MoreHorizontal,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { UserAccountPopover } from "@/components/auth/user-account-popover";
import { TimerControl } from "@/components/retro/timer-control";
import { AppLogo } from "@/components/shared/app-logo";
import { EditableTitle } from "@/components/shared/editable-title";
import { SessionCodeButton } from "@/components/shared/session-code-button";
import { ShareMenu } from "@/components/shared/share-menu";
import { VisibilityBadge } from "@/components/shared/visibility-badge";
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
import { FIELD_LIMITS } from "@/lib/constants/field-limits";
import type { RetroBoard } from "@/lib/types";

interface BoardHeaderProps {
  board: RetroBoard;
  cardCount: number;
  isAuthor: boolean;
  onCopyMarkdown: () => void;
  onDeleteBoard: () => void;
  onDownloadMarkdown: () => void;
  onlineCount: number;
  onSetTimer: (seconds: number) => void;
  onTimerExpire: () => void;
  onTimerReset: () => void;
  onTimerToggle: () => void;
  onTitleUpdate: (newTitle: string) => void;
  onToggleLock: () => void;
  onToggleParticipants: () => void;
  onToggleVisibility: () => void;
  participantCount: number;
  participantsOpen: boolean;
  voteCount: number;
}

export function BoardHeader({
  board,
  cardCount,
  isAuthor,
  onCopyMarkdown,
  onDeleteBoard,
  onDownloadMarkdown,
  onSetTimer,
  onTimerExpire,
  onTimerReset,
  onTimerToggle,
  onTitleUpdate,
  onToggleLock,
  onToggleParticipants,
  onToggleVisibility,
  onlineCount,
  participantCount,
  participantsOpen,
  voteCount,
}: BoardHeaderProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  return (
    <header className="border-border border-b-2 bg-background">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 md:px-4">
        <AppLogo />

        <div className="min-w-0 flex-1 basis-40 border-border border-l-2 pl-3">
          <EditableTitle
            canEdit={isAuthor}
            label="Board title"
            maxLength={FIELD_LIMITS.sessionTitle}
            onSave={onTitleUpdate}
            value={board.title}
          />
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 text-muted-foreground text-xs">
            <SessionCodeButton slug={board.slug} />
            <span className="shrink-0">
              {cardCount} card{cardCount === 1 ? "" : "s"} · {voteCount} vote
              {voteCount === 1 ? "" : "s"}
            </span>
            {!board.is_public && (
              <span className="inline-flex shrink-0 items-center gap-1 font-bold text-foreground sm:hidden">
                Private
              </span>
            )}
            {board.is_locked && (
              <span className="inline-flex shrink-0 items-center gap-1 font-bold text-foreground">
                <Lock aria-hidden="true" className="h-3 w-3" /> Locked
              </span>
            )}
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:gap-2">
          <TimerControl
            board={board}
            canControl={isAuthor}
            onExpire={onTimerExpire}
            onReset={onTimerReset}
            onSetDuration={onSetTimer}
            onToggle={onTimerToggle}
          />

          <Button
            aria-expanded={participantsOpen}
            aria-label={`Participants: ${onlineCount} online of ${participantCount}`}
            className="h-9 gap-1.5 rounded-lg border-2 border-border bg-transparent px-2.5 font-bold shadow-sm"
            onClick={onToggleParticipants}
            title="Participants"
            variant="outline"
          >
            <Users aria-hidden="true" className="h-4 w-4" />
            <span className="tabular-nums">
              {onlineCount}
              <span className="text-muted-foreground">/{participantCount}</span>
            </span>
          </Button>

          <ShareMenu
            captureSelector="[data-board-capture]"
            filenameBase={`${board.slug}-retro`}
            shareText={`Join the retro “${board.title}” on r8ro`}
            title={board.title}
          >
            <DropdownMenuItem onSelect={onCopyMarkdown}>
              <ClipboardCopy aria-hidden="true" className="mr-2 h-4 w-4" />
              Copy as Markdown
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDownloadMarkdown}>
              <Download aria-hidden="true" className="mr-2 h-4 w-4" />
              Download Markdown
            </DropdownMenuItem>
          </ShareMenu>

          <span className="max-sm:hidden">
            <VisibilityBadge isPublic={board.is_public} />
          </span>

          {isAuthor && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label="Board settings"
                  className="h-9 w-9 rounded-lg border-2 border-border bg-transparent p-0 shadow-sm"
                  variant="outline"
                >
                  <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-60 rounded-xl border-2 border-border"
              >
                <DropdownMenuItem onSelect={onToggleVisibility}>
                  {board.is_public ? (
                    <Lock aria-hidden="true" className="mr-2 h-4 w-4" />
                  ) : (
                    <Globe aria-hidden="true" className="mr-2 h-4 w-4" />
                  )}
                  <span className="flex flex-col">
                    {board.is_public ? "Make private" : "Make public"}
                    <span className="text-muted-foreground text-xs">
                      {board.is_public
                        ? "Only people already here keep access"
                        : "Anyone with the link can join"}
                    </span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onToggleLock}>
                  {board.is_locked ? (
                    <LockOpen aria-hidden="true" className="mr-2 h-4 w-4" />
                  ) : (
                    <Lock aria-hidden="true" className="mr-2 h-4 w-4" />
                  )}
                  <span className="flex flex-col">
                    {board.is_locked ? "Unlock board" : "Lock board"}
                    <span className="text-muted-foreground text-xs">
                      {board.is_locked
                        ? "Allow cards and votes again"
                        : "Freeze cards and votes for everyone"}
                    </span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                  onSelect={() => setShowDeleteDialog(true)}
                >
                  <Trash2 aria-hidden="true" className="mr-2 h-4 w-4" />
                  Delete board
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <div className="ml-auto flex items-center gap-1.5 sm:ml-0 sm:gap-2">
            <ThemeToggle />
            <UserAccountPopover variant="compact" />
          </div>
        </div>
      </div>

      <AlertDialog onOpenChange={setShowDeleteDialog} open={showDeleteDialog}>
        <AlertDialogContent className="rounded-2xl border-2 border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black text-xl">
              Delete this board?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Every card and vote is permanently deleted for all participants.
              Export it first if you want to keep a copy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg font-bold">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90"
              onClick={onDeleteBoard}
            >
              Delete board
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
