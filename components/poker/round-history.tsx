"use client";

import { History, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PokerRound } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils/relative-time";

interface RoundHistoryProps {
  canDelete: boolean;
  onDelete: (roundId: string) => void;
  rounds: PokerRound[];
}

export function RoundHistory({
  canDelete,
  onDelete,
  rounds,
}: RoundHistoryProps) {
  const estimated = rounds.filter((round) => round.estimate);
  const total = estimated.reduce((sum, round) => {
    const n = Number(round.estimate);
    return Number.isFinite(n) ? sum + n : sum;
  }, 0);
  const allNumeric =
    estimated.length > 0 &&
    estimated.every((round) => Number.isFinite(Number(round.estimate)));

  return (
    <section
      aria-labelledby="history-heading"
      className="rounded-2xl border-2 border-border bg-background p-4 shadow-sm md:p-5"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2
          className="flex items-center gap-1.5 font-bold text-muted-foreground text-xs uppercase tracking-wide"
          id="history-heading"
        >
          <History aria-hidden="true" className="h-4 w-4" />
          Estimated stories
        </h2>
        {allNumeric && (
          <p className="font-bold text-sm tabular-nums">Total {total}</p>
        )}
      </div>

      {rounds.length === 0 ? (
        <p className="mt-3 text-muted-foreground text-sm">
          Finished stories appear here with their estimate when the host moves
          to the next story.
        </p>
      ) : (
        <ol className="mt-3 space-y-2">
          {[...rounds].reverse().map((round, index) => (
            <li
              className="group flex items-start gap-3 rounded-xl border-2 border-border px-3 py-2"
              key={round.id}
            >
              <span className="mt-0.5 w-6 shrink-0 text-muted-foreground text-xs tabular-nums">
                #{rounds.length - index}
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 break-words font-semibold text-sm">
                  {round.story || (
                    <span className="text-muted-foreground italic">
                      Untitled story
                    </span>
                  )}
                </p>
                <p className="truncate text-muted-foreground text-xs">
                  {round.votes.length} vote{round.votes.length === 1 ? "" : "s"}
                  {round.votes.length > 0 &&
                    `: ${round.votes.map((v) => v.value).join(", ")}`}{" "}
                  · {formatRelativeTime(new Date(round.created_at))}
                </p>
              </div>
              <span className="min-w-9 shrink-0 rounded-lg border-2 border-primary bg-primary/15 px-2 py-0.5 text-center font-black font-mono">
                {round.estimate ?? "—"}
              </span>
              {canDelete && (
                <Button
                  aria-label={`Delete round ${rounds.length - index}`}
                  className="h-7 w-7 shrink-0 rounded-lg p-0 text-muted-foreground hover:text-destructive md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                  onClick={() => onDelete(round.id)}
                  variant="ghost"
                >
                  <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
