"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface VotingCardsProps {
  isObserver: boolean;
  isVotingActive: boolean;
  onVote: (value: string) => void;
  scale: string[];
  selectedValue: string | null;
  votesRevealed: boolean;
}

export function VotingCards({
  scale,
  selectedValue,
  isVotingActive,
  votesRevealed,
  onVote,
  isObserver,
}: VotingCardsProps) {
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const previousSelectedValue = useRef<string | null>(null);
  const previousVotingState = useRef(isVotingActive);
  const previousRevealState = useRef(votesRevealed);

  useEffect(() => {
    if (isObserver) {
      setLiveAnnouncement("Observer mode enabled. Voting is disabled.");
      return;
    }

    if (!isVotingActive && previousVotingState.current) {
      setLiveAnnouncement("Voting is now paused.");
    }

    if (isVotingActive && !previousVotingState.current) {
      setLiveAnnouncement("Voting is now active.");
    }

    if (votesRevealed && !previousRevealState.current) {
      setLiveAnnouncement("Votes are revealed.");
    }

    if (!votesRevealed && previousRevealState.current) {
      setLiveAnnouncement("Votes are hidden.");
    }

    if (selectedValue && selectedValue !== previousSelectedValue.current) {
      setLiveAnnouncement(`Vote submitted: ${selectedValue}.`);
    }

    previousSelectedValue.current = selectedValue;
    previousVotingState.current = isVotingActive;
    previousRevealState.current = votesRevealed;
  }, [isObserver, isVotingActive, selectedValue, votesRevealed]);

  const handleCardClick = (value: string) => {
    if (!isVotingActive || votesRevealed || isObserver) {
      return;
    }
    onVote(value);
  };

  if (!(isVotingActive || votesRevealed)) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-border bg-muted px-4 py-12">
        <p className="font-bold text-lg text-muted-foreground">
          Waiting for admin to start voting…
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p aria-live="polite" className="sr-only" role="status">
        {liveAnnouncement}
      </p>
      <h2 className="font-black text-xl uppercase">Select Your Vote</h2>
      <div className="grid grid-cols-4 gap-4 md:grid-cols-7">
        {scale.map((value, index) => {
          const isSelected = selectedValue === value;
          const isDisabled = !isVotingActive || votesRevealed || isObserver;

          return (
            <button
              aria-label={`Vote ${value}`}
              aria-pressed={isSelected}
              className={cn(
                "fade-in zoom-in-95 relative aspect-square animate-in rounded-xl border-2 shadow-md transition-[transform,border-color,box-shadow,background-color,color] duration-200",
                "flex items-center justify-center font-black text-4xl md:text-5xl",
                isSelected && !isDisabled
                  ? "scale-105 border-primary bg-primary text-primary-foreground"
                  : isDisabled
                    ? "cursor-not-allowed border-border/50 bg-muted/50 text-muted-foreground"
                    : "cursor-pointer border-border bg-background hover:scale-105 hover:border-primary hover:shadow-lg"
              )}
              disabled={isDisabled}
              key={value}
              onClick={() => handleCardClick(value)}
              style={{
                animationDelay: `${index * 35}ms`,
                animationDuration: "250ms",
              }}
              type="button"
            >
              {value}
              {isSelected && !isDisabled && (
                <div className="zoom-in-75 fade-in absolute -top-2 -right-2 animate-in rounded-full bg-primary p-1 text-primary-foreground duration-200">
                  <Check className="h-4 w-4" />
                </div>
              )}
            </button>
          );
        })}
      </div>
      {selectedValue && isVotingActive && !votesRevealed && !isObserver && (
        <div className="fade-in slide-in-from-bottom-1 flex animate-in items-center justify-center gap-2 font-bold text-primary text-sm duration-300">
          <Check className="h-4 w-4" />
          Vote submitted: {selectedValue}
        </div>
      )}
      {isObserver && (
        <div className="fade-in slide-in-from-bottom-1 flex animate-in items-center justify-center gap-2 font-bold text-muted-foreground text-sm duration-300">
          You are an observer and cannot vote
        </div>
      )}
    </div>
  );
}
