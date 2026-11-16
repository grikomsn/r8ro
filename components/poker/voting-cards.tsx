"use client";

import { Check, Glasses } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VotingCardsProps {
  isObserver: boolean;
  isPending: boolean;
  isVotingActive: boolean;
  onToggleObserver: () => void;
  onVote: (value: string | null) => void;
  scale: string[];
  selectedValue: string | null;
  votesRevealed: boolean;
}

export function VotingCards({
  isObserver,
  isPending,
  isVotingActive,
  onToggleObserver,
  onVote,
  scale,
  selectedValue,
  votesRevealed,
}: VotingCardsProps) {
  const [announcement, setAnnouncement] = useState("");
  const previous = useRef({ isVotingActive, votesRevealed });

  useEffect(() => {
    if (votesRevealed && !previous.current.votesRevealed) {
      setAnnouncement("Votes are revealed.");
    } else if (isVotingActive && !previous.current.isVotingActive) {
      setAnnouncement("Voting is open.");
    } else if (!isVotingActive && previous.current.isVotingActive) {
      setAnnouncement("Voting is paused.");
    }
    previous.current = { isVotingActive, votesRevealed };
  }, [isVotingActive, votesRevealed]);

  const canVote = isVotingActive && !votesRevealed && !isObserver;

  let hint: string;
  if (isObserver) {
    hint = "You are observing. Observers see results but do not vote.";
  } else if (votesRevealed) {
    hint = selectedValue
      ? `You voted ${selectedValue}. Waiting for the host to start the next story.`
      : "Votes are revealed. Waiting for the host to start the next story.";
  } else if (!isVotingActive) {
    hint = "Voting is paused. The host will open it when the story is ready.";
  } else if (selectedValue) {
    hint = `You voted ${selectedValue}. Pick another card to change it, or the same card to withdraw.`;
  } else {
    hint = "Pick a card. Nobody sees your vote until the host reveals.";
  }

  return (
    <section
      aria-labelledby="vote-heading"
      className="rounded-2xl border-2 border-border bg-background p-4 shadow-sm md:p-5"
    >
      <p aria-live="polite" className="sr-only" role="status">
        {announcement}
      </p>
      <h2
        className="font-bold text-muted-foreground text-xs uppercase tracking-wide"
        id="vote-heading"
      >
        Your vote
      </h2>

      {isObserver && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border-2 border-border border-dashed px-3 py-2.5">
          <Glasses aria-hidden="true" className="h-5 w-5 shrink-0" />
          <p className="min-w-0 flex-1 text-sm">
            You are observing. You see the results but do not vote.
          </p>
          <Button
            className="h-8 shrink-0 rounded-lg font-bold"
            onClick={onToggleObserver}
            size="sm"
            variant="outline"
          >
            Join vote
          </Button>
        </div>
      )}

      <div
        aria-label="Voting cards"
        // Two even rows on phones and tablets, one row on wide screens, so a
        // scale never wraps with a lonely card or two.
        className={cn(
          "mt-3 grid grid-cols-[repeat(var(--cols-half),minmax(0,1fr))] gap-2 md:gap-3 lg:grid-cols-[repeat(var(--cols-all),minmax(0,1fr))] lg:gap-2",
          isObserver && "hidden"
        )}
        role="group"
        style={
          {
            "--cols-half": Math.ceil(scale.length / 2),
            "--cols-all": scale.length,
          } as React.CSSProperties
        }
      >
        {scale.map((value) => {
          const isSelected = selectedValue === value;
          return (
            <button
              aria-label={
                isSelected ? `Withdraw vote ${value}` : `Vote ${value}`
              }
              aria-pressed={isSelected}
              className={cn(
                "relative flex aspect-[4/5] items-center justify-center rounded-xl border-2 font-black text-xl shadow-xs transition-[transform,border-color,box-shadow,background-color,opacity] duration-150 sm:aspect-[3/4] sm:text-2xl md:text-3xl lg:text-2xl",
                isSelected
                  ? "-translate-y-1 border-primary bg-primary text-primary-foreground shadow-md"
                  : "border-border bg-background",
                canVote &&
                  !isSelected &&
                  "hover:-translate-y-0.5 hover:border-primary hover:shadow-md",
                !(canVote || isSelected) && "opacity-40",
                !canVote && "cursor-not-allowed"
              )}
              disabled={!canVote || isPending}
              key={value}
              onClick={() => onVote(isSelected ? null : value)}
              type="button"
            >
              {value}
              {isSelected && (
                <span className="absolute -top-2 -right-2 rounded-full border-2 border-background bg-foreground p-0.5 text-background">
                  <Check aria-hidden="true" className="h-3.5 w-3.5" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!isObserver && (
        <p className="mt-3 text-muted-foreground text-sm">{hint}</p>
      )}
    </section>
  );
}
