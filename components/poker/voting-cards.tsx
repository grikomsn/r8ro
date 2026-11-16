"use client";

import { Check, Glasses } from "lucide-react";
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          className="font-bold text-muted-foreground text-sm uppercase tracking-wide"
          id="vote-heading"
        >
          Your vote
        </h2>
        <Button
          aria-pressed={isObserver}
          className="h-8 rounded-lg text-xs"
          onClick={onToggleObserver}
          title={
            isObserver
              ? "Join the vote again"
              : "Watch without voting, for example as a product owner"
          }
          variant={isObserver ? "secondary" : "ghost"}
        >
          <Glasses aria-hidden="true" className="mr-1.5 h-4 w-4" />
          {isObserver ? "Observing · join vote" : "Observe only"}
        </Button>
      </div>

      <div
        aria-label="Voting cards"
        className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] gap-2 md:grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] md:gap-3"
        role="group"
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
                "relative flex aspect-[3/4] items-center justify-center rounded-xl border-2 font-black text-2xl shadow-sm transition-[transform,border-color,box-shadow,background-color,opacity] duration-150 md:text-3xl",
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

      <p className="mt-3 text-muted-foreground text-sm">{hint}</p>
    </section>
  );
}
