"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface VotingCardsProps {
  scale: string[];
  selectedValue: string | null;
  isVotingActive: boolean;
  votesRevealed: boolean;
  onVote: (value: string) => void;
  isObserver: boolean;
}

export function VotingCards({
  scale,
  selectedValue,
  isVotingActive,
  votesRevealed,
  onVote,
  isObserver,
}: VotingCardsProps) {
  const handleCardClick = (value: string) => {
    if (!isVotingActive || votesRevealed || isObserver) return;
    onVote(value);
  };

  if (!isVotingActive && !votesRevealed) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 rounded-xl border-2 border-border bg-muted">
        <p className="text-lg font-bold text-muted-foreground">
          Waiting for admin to start voting...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-black uppercase">Select Your Vote</h2>
      <div className="grid grid-cols-4 md:grid-cols-7 gap-4">
        {scale.map((value) => {
          const isSelected = selectedValue === value;
          const isDisabled = !isVotingActive || votesRevealed || isObserver;

          return (
            <button
              key={value}
              onClick={() => handleCardClick(value)}
              disabled={isDisabled}
              className={cn(
                "relative aspect-square rounded-xl border-2 transition-all duration-200 shadow-md",
                "flex items-center justify-center text-4xl md:text-5xl font-black",
                isSelected && !isDisabled
                  ? "border-primary bg-primary text-primary-foreground scale-105"
                  : isDisabled
                    ? "border-border/50 bg-muted/50 text-muted-foreground cursor-not-allowed"
                    : "border-border bg-background hover:border-primary hover:scale-105 hover:shadow-lg cursor-pointer"
              )}
              aria-label={`Vote ${value}`}
              aria-pressed={isSelected}
            >
              {value}
              {isSelected && !isDisabled && (
                <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-1">
                  <Check className="h-4 w-4" />
                </div>
              )}
            </button>
          );
        })}
      </div>
      {selectedValue && isVotingActive && !votesRevealed && !isObserver && (
        <div className="flex items-center justify-center gap-2 text-sm font-bold text-primary">
          <Check className="h-4 w-4" />
          Vote submitted: {selectedValue}
        </div>
      )}
      {isObserver && (
        <div className="flex items-center justify-center gap-2 text-sm font-bold text-muted-foreground">
          You are an observer and cannot vote
        </div>
      )}
    </div>
  );
}

