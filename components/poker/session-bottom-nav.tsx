"use client";

import { Eye, EyeOff, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PokerSession } from "@/lib/types";

interface SessionBottomNavProps {
  session: PokerSession;
  isAuthor: boolean;
  onToggleVoting: () => void;
  onToggleReveal: () => void;
  onClearVotes: () => void;
}

export function SessionBottomNav({
  session,
  isAuthor,
  onToggleVoting,
  onToggleReveal,
  onClearVotes,
}: SessionBottomNavProps) {
  if (!isAuthor) {
    return null;
  }

  return (
    <TooltipProvider>
      <nav
        aria-label="Session controls"
        className="fixed bottom-4 left-1/2 z-50 flex h-16 -translate-x-1/2 items-center justify-center gap-2 rounded-xl border-2 border-border bg-background/80 px-4 shadow-lg backdrop-blur-md md:h-20 md:px-6"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={
                session.is_voting_active ? "Stop voting" : "Start voting"
              }
              className={`h-10 rounded-lg border-2 font-bold shadow-sm ${
                session.is_voting_active
                  ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                  : "border-border bg-transparent"
              }`}
              onClick={onToggleVoting}
              variant={session.is_voting_active ? "default" : "outline"}
            >
              {session.is_voting_active ? (
                <>
                  <Pause aria-hidden="true" className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Stop</span>
                </>
              ) : (
                <>
                  <Play aria-hidden="true" className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Start</span>
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent className="md:hidden">
            {session.is_voting_active ? "Stop Voting" : "Start Voting"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={
                session.votes_revealed ? "Hide cards" : "Reveal cards"
              }
              className={`h-10 rounded-lg border-2 font-bold shadow-sm ${
                session.votes_revealed
                  ? "border-chart-2 bg-chart-2 text-primary-foreground hover:bg-chart-2/90"
                  : "border-border bg-transparent"
              }`}
              onClick={onToggleReveal}
              variant={session.votes_revealed ? "default" : "outline"}
            >
              {session.votes_revealed ? (
                <>
                  <EyeOff aria-hidden="true" className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Hide</span>
                </>
              ) : (
                <>
                  <Eye aria-hidden="true" className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Reveal</span>
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent className="md:hidden">
            {session.votes_revealed ? "Hide Cards" : "Reveal Cards"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label="Clear all votes"
              className="h-10 rounded-lg border-2 border-border bg-transparent font-bold shadow-sm"
              onClick={onClearVotes}
              variant="outline"
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Clear</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent className="md:hidden">Clear Votes</TooltipContent>
        </Tooltip>
      </nav>
    </TooltipProvider>
  );
}
