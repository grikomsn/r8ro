"use client";

import {
  ClipboardCopy,
  Download,
  Globe,
  Lock,
  LockOpen,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { UserAccountPopover } from "@/components/auth/user-account-popover";
import { TimerControl } from "@/components/retro/timer-control";
import { EditableTitle } from "@/components/shared/editable-title";
import {
  PresenceButton,
  type PresenceParticipant,
} from "@/components/shared/presence-button";
import { SessionCodeButton } from "@/components/shared/session-code-button";
import { SessionTopbar } from "@/components/shared/session-topbar";
import { ShareMenu, ShareMenuItems } from "@/components/shared/share-menu";
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
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SM_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { FIELD_LIMITS } from "@/lib/constants/field-limits";
import type { RetroBoard } from "@/lib/types";

export type CardSortMode = "auto" | "added" | "votes";

interface BoardHeaderProps {
  board: RetroBoard;
  cardCount: number;
  currentUserId: string | null;
  isAuthor: boolean;
  onCopyMarkdown: () => void;
  onDeleteBoard: () => void;
  onDownloadMarkdown: () => void;
  onSetTimer: (seconds: number) => void;
  onSortChange: (mode: CardSortMode) => void;
  onTimerExpire: () => void;
  onTimerReset: () => void;
  onTimerToggle: () => void;
  onTitleUpdate: (newTitle: string) => void;
  onToggleLock: () => void;
  onToggleVisibility: () => void;
  participants: PresenceParticipant[];
  sortMode: CardSortMode;
  voteCount: number;
}

export function BoardHeader({
  board,
  cardCount,
  currentUserId,
  isAuthor,
  onCopyMarkdown,
  onDeleteBoard,
  onDownloadMarkdown,
  onSetTimer,
  onSortChange,
  onTimerExpire,
  onTimerReset,
  onTimerToggle,
  onTitleUpdate,
  onToggleLock,
  onToggleVisibility,
  participants,
  sortMode,
  voteCount,
}: BoardHeaderProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const isWide = useMediaQuery(SM_QUERY);

  const shareOptions = {
    captureSelector: "[data-board-capture]",
    exportItems: (
      <>
        <DropdownMenuItem onSelect={onCopyMarkdown}>
          <ClipboardCopy aria-hidden="true" className="mr-2 h-4 w-4" />
          Copy as Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onDownloadMarkdown}>
          <Download aria-hidden="true" className="mr-2 h-4 w-4" />
          Download Markdown
        </DropdownMenuItem>
      </>
    ),
    filenameBase: `${board.slug}-retro`,
    isPublic: board.is_public,
    shareText: `Join the retro “${board.title}” on r8ro`,
    title: board.title,
  };

  return (
    <>
      <SessionTopbar
        actions={
          <>
            <TimerControl
              board={board}
              canControl={isAuthor}
              onExpire={onTimerExpire}
              onReset={onTimerReset}
              onSetDuration={onSetTimer}
              onToggle={onTimerToggle}
            />
            <PresenceButton
              authorId={board.author_id}
              currentUserId={currentUserId}
              participants={participants}
            />
            {isWide && <ShareMenu {...shareOptions} />}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label="Board menu"
                  className="h-9 w-9 rounded-lg p-0"
                  variant="ghost"
                >
                  <MoreHorizontal aria-hidden="true" className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-64 rounded-xl border-2 border-border"
              >
                {!isWide && (
                  <>
                    <ShareMenuItems {...shareOptions} />
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuLabel className="text-muted-foreground text-xs uppercase tracking-wide">
                  Order cards by
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  onValueChange={(value) => onSortChange(value as CardSortMode)}
                  value={sortMode}
                >
                  <DropdownMenuRadioItem value="auto">
                    <span className="flex flex-col">
                      Automatic
                      <span className="text-muted-foreground text-xs">
                        Oldest first, most votes once locked
                      </span>
                    </span>
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="added">
                    Oldest first
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="votes">
                    Most votes
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                {isAuthor && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-muted-foreground text-xs uppercase tracking-wide">
                      Host
                    </DropdownMenuLabel>
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
                            : "Freeze cards and votes to discuss"}
                        </span>
                      </span>
                    </DropdownMenuItem>
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
                    <DropdownMenuItem
                      className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                      onSelect={() => setShowDeleteDialog(true)}
                    >
                      <Trash2 aria-hidden="true" className="mr-2 h-4 w-4" />
                      Delete board
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <UserAccountPopover variant="compact" />
          </>
        }
        homeHref="/"
        meta={
          <>
            <SessionCodeButton slug={board.slug} />
            <span aria-hidden="true">·</span>
            <span>
              {cardCount} card{cardCount === 1 ? "" : "s"}
              <span className="max-sm:hidden">
                {" "}
                · {voteCount} vote{voteCount === 1 ? "" : "s"}
              </span>
            </span>
            {!board.is_public && (
              <span className="inline-flex items-center gap-1 font-bold text-foreground">
                <Lock aria-hidden="true" className="h-3 w-3" />
                Private
              </span>
            )}
          </>
        }
        title={
          <EditableTitle
            canEdit={isAuthor}
            label="Board title"
            maxLength={FIELD_LIMITS.sessionTitle}
            onSave={onTitleUpdate}
            value={board.title}
          />
        }
      />

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
    </>
  );
}
