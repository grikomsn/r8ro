"use client";

import {
  ClipboardCopy,
  Download,
  Globe,
  Lock,
  MoreHorizontal,
  Ruler,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { UserAccountPopover } from "@/components/auth/user-account-popover";
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FIELD_LIMITS } from "@/lib/constants/field-limits";
import {
  detectScaleType,
  VOTING_SCALE_LABELS,
  VOTING_SCALES,
  type VotingScaleType,
} from "@/lib/constants/poker-scales";
import type { PokerSession } from "@/lib/types";

interface SessionHeaderProps {
  isAuthor: boolean;
  onCopyMarkdown: () => void;
  onDeleteSession: () => void;
  onDownloadMarkdown: () => void;
  onlineCount: number;
  onTitleUpdate: (newTitle: string) => void;
  onToggleVisibility: () => void;
  onUpdateScale: (scale: string[]) => void;
  participantCount: number;
  roundNumber: number;
  session: PokerSession;
}

export function SessionHeader({
  isAuthor,
  onCopyMarkdown,
  onDeleteSession,
  onDownloadMarkdown,
  onTitleUpdate,
  onToggleVisibility,
  onUpdateScale,
  onlineCount,
  participantCount,
  roundNumber,
  session,
}: SessionHeaderProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const scaleType = detectScaleType(session.voting_scale);

  return (
    <header className="border-border border-b-2 bg-background">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 md:px-4">
        <AppLogo href="/poker" />

        <div className="min-w-0 flex-1 basis-40 border-border border-l-2 pl-3">
          <EditableTitle
            canEdit={isAuthor}
            label="Session title"
            maxLength={FIELD_LIMITS.sessionTitle}
            onSave={onTitleUpdate}
            value={session.title}
          />
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 text-muted-foreground text-xs">
            <SessionCodeButton slug={session.slug} />
            <span>
              Round {roundNumber} ·{" "}
              {scaleType ? VOTING_SCALE_LABELS[scaleType] : "Custom"} ·{" "}
              {onlineCount}/{participantCount} online
            </span>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:gap-2">
          <ShareMenu
            captureSelector="[data-session-capture]"
            filenameBase={`${session.slug}-poker`}
            shareText={`Join the planning poker “${session.title}” on r8ro`}
            title={session.title}
          >
            <DropdownMenuItem onSelect={onCopyMarkdown}>
              <ClipboardCopy aria-hidden="true" className="mr-2 h-4 w-4" />
              Copy results as Markdown
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDownloadMarkdown}>
              <Download aria-hidden="true" className="mr-2 h-4 w-4" />
              Download Markdown
            </DropdownMenuItem>
          </ShareMenu>

          <VisibilityBadge isPublic={session.is_public} />

          {isAuthor && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label="Session settings"
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
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Ruler aria-hidden="true" className="mr-2 h-4 w-4" />
                    Voting scale
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="rounded-xl border-2 border-border">
                    <DropdownMenuRadioGroup
                      onValueChange={(value) =>
                        onUpdateScale([
                          ...VOTING_SCALES[value as VotingScaleType],
                        ])
                      }
                      value={scaleType ?? ""}
                    >
                      {(Object.keys(VOTING_SCALES) as VotingScaleType[]).map(
                        (type) => (
                          <DropdownMenuRadioItem key={type} value={type}>
                            <span className="flex flex-col">
                              {VOTING_SCALE_LABELS[type]}
                              <span className="font-mono text-muted-foreground text-xs">
                                {VOTING_SCALES[type].join(" ")}
                              </span>
                            </span>
                          </DropdownMenuRadioItem>
                        )
                      )}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem onSelect={onToggleVisibility}>
                  {session.is_public ? (
                    <Lock aria-hidden="true" className="mr-2 h-4 w-4" />
                  ) : (
                    <Globe aria-hidden="true" className="mr-2 h-4 w-4" />
                  )}
                  <span className="flex flex-col">
                    {session.is_public ? "Make private" : "Make public"}
                    <span className="text-muted-foreground text-xs">
                      {session.is_public
                        ? "Only people already here keep access"
                        : "Anyone with the link can join"}
                    </span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                  onSelect={() => setShowDeleteDialog(true)}
                >
                  <Trash2 aria-hidden="true" className="mr-2 h-4 w-4" />
                  Delete session
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
              Delete this session?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Every vote and the round history are permanently deleted for all
              participants. Export the results first if you want to keep them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg font-bold">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90"
              onClick={onDeleteSession}
            >
              Delete session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
