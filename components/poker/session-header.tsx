"use client";

import {
  ClipboardCopy,
  Download,
  Glasses,
  Globe,
  Lock,
  MoreHorizontal,
  Ruler,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { UserAccountPopover } from "@/components/auth/user-account-popover";
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SM_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { FIELD_LIMITS } from "@/lib/constants/field-limits";
import {
  detectScaleType,
  VOTING_SCALE_LABELS,
  VOTING_SCALES,
  type VotingScaleType,
} from "@/lib/constants/poker-scales";
import type { PokerSession } from "@/lib/types";

interface SessionHeaderProps {
  currentUserId: string | null;
  isAuthor: boolean;
  isObserver: boolean;
  onCopyMarkdown: () => void;
  onDeleteSession: () => void;
  onDownloadMarkdown: () => void;
  onTitleUpdate: (newTitle: string) => void;
  onToggleObserver: () => void;
  onToggleVisibility: () => void;
  onUpdateScale: (scale: string[]) => void;
  participants: PresenceParticipant[];
  roundNumber: number;
  session: PokerSession;
}

export function SessionHeader({
  currentUserId,
  isAuthor,
  isObserver,
  onCopyMarkdown,
  onDeleteSession,
  onDownloadMarkdown,
  onTitleUpdate,
  onToggleObserver,
  onToggleVisibility,
  onUpdateScale,
  participants,
  roundNumber,
  session,
}: SessionHeaderProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const isWide = useMediaQuery(SM_QUERY);
  const scaleType = detectScaleType(session.voting_scale);

  const shareOptions = {
    captureSelector: "[data-session-capture]",
    exportItems: (
      <>
        <DropdownMenuItem onSelect={onCopyMarkdown}>
          <ClipboardCopy aria-hidden="true" className="mr-2 h-4 w-4" />
          Copy results as Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onDownloadMarkdown}>
          <Download aria-hidden="true" className="mr-2 h-4 w-4" />
          Download Markdown
        </DropdownMenuItem>
      </>
    ),
    filenameBase: `${session.slug}-poker`,
    isPublic: session.is_public,
    shareText: `Join the planning poker “${session.title}” on r8ro`,
    title: session.title,
  };

  return (
    <>
      <SessionTopbar
        actions={
          <>
            <PresenceButton
              authorId={session.author_id}
              currentUserId={currentUserId}
              participants={participants}
            />
            {isWide && <ShareMenu {...shareOptions} />}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label="Session menu"
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
                <DropdownMenuCheckboxItem
                  checked={isObserver}
                  onCheckedChange={onToggleObserver}
                >
                  <span className="flex flex-col">
                    <span className="flex items-center gap-1.5">
                      <Glasses aria-hidden="true" className="h-4 w-4" />
                      Observe only
                    </span>
                    <span className="text-muted-foreground text-xs">
                      Watch without voting
                    </span>
                  </span>
                </DropdownMenuCheckboxItem>
                {isAuthor && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-muted-foreground text-xs uppercase tracking-wide">
                      Host
                    </DropdownMenuLabel>
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
                          {(
                            Object.keys(VOTING_SCALES) as VotingScaleType[]
                          ).map((type) => (
                            <DropdownMenuRadioItem key={type} value={type}>
                              <span className="flex flex-col">
                                {VOTING_SCALE_LABELS[type]}
                                <span className="font-mono text-muted-foreground text-xs">
                                  {VOTING_SCALES[type].join(" ")}
                                </span>
                              </span>
                            </DropdownMenuRadioItem>
                          ))}
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
                    <DropdownMenuItem
                      className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                      onSelect={() => setShowDeleteDialog(true)}
                    >
                      <Trash2 aria-hidden="true" className="mr-2 h-4 w-4" />
                      Delete session
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <UserAccountPopover variant="compact" />
          </>
        }
        homeHref="/poker"
        meta={
          <>
            <SessionCodeButton slug={session.slug} />
            <span aria-hidden="true">·</span>
            <span>Round {roundNumber}</span>
            <span aria-hidden="true" className="max-sm:hidden">
              ·
            </span>
            <span className="max-sm:hidden">
              {scaleType ? VOTING_SCALE_LABELS[scaleType] : "Custom scale"}
            </span>
            {!session.is_public && (
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
            label="Session title"
            maxLength={FIELD_LIMITS.sessionTitle}
            onSave={onTitleUpdate}
            value={session.title}
          />
        }
      />

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
    </>
  );
}
