"use client";

import {
  ArrowRight,
  Eye,
  EyeOff,
  Pause,
  Pencil,
  Play,
  RotateCcw,
} from "lucide-react";
import { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { FIELD_LIMITS } from "@/lib/constants/field-limits";
import type { PokerSession } from "@/lib/types";
import { cn } from "@/lib/utils";

interface RoundPanelProps {
  isAuthor: boolean;
  onClearVotes: () => void;
  onNextRound: () => void;
  onStoryUpdate: (story: string) => void;
  onToggleReveal: () => void;
  onToggleVoting: () => void;
  pendingActions: Record<string, boolean>;
  roundNumber: number;
  session: PokerSession;
  votedCount: number;
  voterCount: number;
}

function StatusChip({ session }: { session: PokerSession }) {
  const [label, className] = session.votes_revealed
    ? ["Revealed", "border-chart-2 bg-chart-2 text-primary-foreground"]
    : session.is_voting_active
      ? ["Voting open", "border-success bg-success text-success-foreground"]
      : ["Voting paused", "border-border bg-muted text-muted-foreground"];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border-2 px-2.5 py-0.5 font-bold text-xs",
        className
      )}
    >
      {label}
    </span>
  );
}

export function RoundPanel({
  isAuthor,
  onClearVotes,
  onNextRound,
  onStoryUpdate,
  onToggleReveal,
  onToggleVoting,
  pendingActions,
  roundNumber,
  session,
  votedCount,
  voterCount,
}: RoundPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(session.current_story ?? "");
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setDraft(session.current_story ?? "");
    }
  }, [isEditing, session.current_story]);

  const save = () => {
    const trimmed = draft.trim();
    if (trimmed !== (session.current_story ?? "")) {
      onStoryUpdate(trimmed);
    }
    setIsEditing(false);
  };

  const allVoted = voterCount > 0 && votedCount >= voterCount;

  return (
    <section
      aria-labelledby="round-heading"
      className="rounded-2xl border-2 border-border bg-background p-4 shadow-sm md:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          className="font-bold text-muted-foreground text-sm uppercase tracking-wide"
          id="round-heading"
        >
          Round {roundNumber} · Story
        </h2>
        <StatusChip session={session} />
      </div>

      {isEditing ? (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Textarea
            aria-label="Story"
            autoFocus
            className="min-h-24 rounded-lg text-base"
            maxLength={FIELD_LIMITS.story}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                save();
              } else if (e.key === "Escape") {
                setIsEditing(false);
              }
            }}
            placeholder="PROJ-123 · As a user I can reset my password"
            value={draft}
          />
          <div className="flex gap-2">
            <Button className="h-9 rounded-lg font-bold" type="submit">
              Save story
            </Button>
            <Button
              className="h-9 rounded-lg"
              onClick={() => setIsEditing(false)}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-2 flex items-start gap-2">
          <p
            className={cn(
              "min-w-0 flex-1 whitespace-pre-wrap break-words text-lg md:text-xl",
              session.current_story
                ? "font-bold"
                : "text-muted-foreground italic"
            )}
          >
            {session.current_story ||
              (isAuthor
                ? "No story yet. Add one so everyone estimates the same thing."
                : "The host has not set a story yet.")}
          </p>
          {isAuthor && (
            <Button
              aria-label={session.current_story ? "Edit story" : "Add story"}
              className="h-9 shrink-0 rounded-lg"
              onClick={() => setIsEditing(true)}
              variant="outline"
            >
              <Pencil aria-hidden="true" className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">
                {session.current_story ? "Edit" : "Add story"}
              </span>
            </Button>
          )}
        </div>
      )}

      {isAuthor && (
        <div
          aria-label="Host controls"
          className="mt-4 flex flex-wrap items-center gap-2 border-border border-t-2 pt-4"
          role="toolbar"
        >
          {session.votes_revealed ? (
            <Button
              className="h-10 rounded-lg font-bold"
              disabled={pendingActions.nextRound}
              onClick={onNextRound}
            >
              Next story
              <ArrowRight aria-hidden="true" className="ml-1.5 h-4 w-4" />
            </Button>
          ) : (
            <Button
              className={cn(
                "h-10 rounded-lg font-bold",
                allVoted && "ring-2 ring-primary ring-offset-2"
              )}
              disabled={pendingActions.toggleReveal || votedCount === 0}
              onClick={onToggleReveal}
            >
              <Eye aria-hidden="true" className="mr-1.5 h-4 w-4" />
              Reveal votes
              <span className="ml-1.5 rounded bg-background/30 px-1.5 tabular-nums">
                {votedCount}/{voterCount}
              </span>
            </Button>
          )}

          {session.votes_revealed ? (
            <Button
              className="h-10 rounded-lg font-bold"
              disabled={pendingActions.toggleReveal}
              onClick={onToggleReveal}
              variant="outline"
            >
              <EyeOff aria-hidden="true" className="mr-1.5 h-4 w-4" />
              Hide votes
            </Button>
          ) : (
            <Button
              className="h-10 rounded-lg font-bold"
              disabled={pendingActions.toggleVoting}
              onClick={onToggleVoting}
              variant="outline"
            >
              {session.is_voting_active ? (
                <>
                  <Pause aria-hidden="true" className="mr-1.5 h-4 w-4" />
                  Pause voting
                </>
              ) : (
                <>
                  <Play aria-hidden="true" className="mr-1.5 h-4 w-4" />
                  Open voting
                </>
              )}
            </Button>
          )}

          <Button
            className="h-10 rounded-lg font-bold"
            disabled={pendingActions.clearVotes || votedCount === 0}
            onClick={() => setConfirmClear(true)}
            variant="ghost"
          >
            <RotateCcw aria-hidden="true" className="mr-1.5 h-4 w-4" />
            Revote
          </Button>
        </div>
      )}

      <AlertDialog onOpenChange={setConfirmClear} open={confirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start a revote?</AlertDialogTitle>
            <AlertDialogDescription>
              Every vote for this story is cleared and hidden again, so the team
              can vote once more after discussing. Use “Next story” instead to
              save the result.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onClearVotes}>
              Clear votes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
