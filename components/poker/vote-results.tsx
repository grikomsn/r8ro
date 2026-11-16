"use client";

import { Check, Crown, Glasses, Lightbulb, PartyPopper } from "lucide-react";
import { useMemo } from "react";
import { Avatar } from "@/components/shared/avatar";
import type { PokerParticipant, PokerVote } from "@/lib/types";
import { cn } from "@/lib/utils";
import { computePokerStats } from "@/lib/utils/poker-stats";

interface VoteResultsProps {
  authorId: string;
  currentUserId: string | null;
  participants: PokerParticipant[];
  scale: string[];
  votes: PokerVote[];
  votesRevealed: boolean;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border-2 border-border bg-background px-3 py-2">
      <p className="font-bold text-muted-foreground text-xs uppercase">
        {label}
      </p>
      <p className="font-black text-2xl tabular-nums">{value}</p>
    </div>
  );
}

export function VoteResults({
  authorId,
  currentUserId,
  participants,
  scale,
  votes,
  votesRevealed,
}: VoteResultsProps) {
  const voteByUser = useMemo(
    () => new Map(votes.map((vote) => [vote.user_id, vote.vote_value])),
    [votes]
  );

  const voters = participants.filter((p) => !p.is_observer);
  const observers = participants.filter((p) => p.is_observer);
  const votedCount = voters.filter(
    (p) => p.has_voted || voteByUser.has(p.user_id)
  ).length;

  const stats = useMemo(() => {
    if (!votesRevealed || votes.length === 0) {
      return null;
    }
    const nameByUser = new Map(
      participants.map((p) => [p.user_id, p.username])
    );
    return computePokerStats(
      scale,
      votes.map((vote) => ({
        value: vote.vote_value,
        voter: nameByUser.get(vote.user_id) ?? "Someone",
      }))
    );
  }, [participants, scale, votes, votesRevealed]);

  const sortedVoters = [...voters].sort(
    (a, b) =>
      Number(b.is_online) - Number(a.is_online) ||
      a.username.localeCompare(b.username)
  );

  const progress = voters.length > 0 ? (votedCount / voters.length) * 100 : 0;

  return (
    <section
      aria-labelledby="results-heading"
      className="rounded-2xl border-2 border-border bg-background p-4 shadow-sm md:p-5"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2
          className="font-bold text-muted-foreground text-xs uppercase tracking-wide"
          id="results-heading"
        >
          {votesRevealed ? "Results" : "Votes"}
        </h2>
        <p className="font-bold text-sm tabular-nums" role="status">
          {votedCount} of {voters.length} voted
        </p>
      </div>
      <div
        aria-hidden="true"
        className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            progress === 100 ? "bg-success" : "bg-primary"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      {stats && (
        <div className="mt-4 space-y-3">
          {stats.consensus ? (
            <p className="flex items-center gap-2 rounded-lg border-2 border-success bg-success/10 px-3 py-2 font-bold text-sm">
              <PartyPopper aria-hidden="true" className="h-4 w-4 shrink-0" />
              Consensus on {stats.suggestion}!
            </p>
          ) : stats.suggestion ? (
            <div className="rounded-lg border-2 border-primary bg-primary/10 px-3 py-2 text-sm">
              <p className="flex items-center gap-2 font-bold">
                <Lightbulb aria-hidden="true" className="h-4 w-4 shrink-0" />
                Suggested estimate: {stats.suggestion}
              </p>
              {stats.spreadIsWide && (
                <p className="mt-1 text-muted-foreground">
                  Votes are far apart. Ask{" "}
                  {stats.lowest.map((v) => v.voter).join(", ")} (
                  {stats.lowest[0]?.value}) and{" "}
                  {stats.highest.map((v) => v.voter).join(", ")} (
                  {stats.highest[0]?.value}) to explain, then revote.
                </p>
              )}
            </div>
          ) : null}

          {stats.isNumeric && stats.average !== null && (
            <div className="grid grid-cols-3 gap-2">
              <Stat
                label="Average"
                value={
                  Number.isInteger(stats.average)
                    ? String(stats.average)
                    : stats.average.toFixed(1)
                }
              />
              <Stat
                label="Lowest"
                value={stats.lowest[0]?.value ?? stats.suggestion ?? "—"}
              />
              <Stat
                label="Highest"
                value={stats.highest[0]?.value ?? stats.suggestion ?? "—"}
              />
            </div>
          )}

          <ul aria-label="Vote distribution" className="space-y-1">
            {stats.distribution
              .filter((d) => d.count > 0)
              .map((d) => (
                <li className="flex items-center gap-2 text-sm" key={d.value}>
                  <span className="w-8 shrink-0 text-right font-black font-mono">
                    {d.value}
                  </span>
                  <span className="h-5 flex-1 overflow-hidden rounded bg-muted">
                    <span
                      className={cn(
                        "block h-full rounded",
                        d.value === stats.suggestion
                          ? "bg-primary"
                          : "bg-chart-4"
                      )}
                      style={{
                        width: `${(d.count / Math.max(1, stats.maxCount)) * 100}%`,
                      }}
                    />
                  </span>
                  <span className="w-14 shrink-0 text-muted-foreground text-xs tabular-nums">
                    {d.count} vote{d.count === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}

      <ul className="mt-4 divide-y-2 divide-border overflow-hidden rounded-xl border-2 border-border">
        {sortedVoters.map((participant) => {
          const value = voteByUser.get(participant.user_id);
          const hasVoted = participant.has_voted || value !== undefined;
          const isYou = participant.user_id === currentUserId;
          const showValue = value !== undefined && (votesRevealed || isYou);
          const isExtreme =
            stats &&
            !stats.consensus &&
            stats.spreadIsWide &&
            value !== undefined &&
            (value === stats.lowest[0]?.value ||
              value === stats.highest[0]?.value);

          return (
            <li
              className={cn(
                "flex items-center gap-2 px-3 py-2",
                !participant.is_online && "text-muted-foreground"
              )}
              key={participant.id}
            >
              <Avatar
                name={participant.username}
                online={participant.is_online}
                size="sm"
              />
              <span className="sr-only">
                {participant.is_online ? "Online" : "Away"}
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold text-sm">
                {participant.username}
                {isYou && (
                  <span className="ml-1.5 font-normal text-muted-foreground text-xs">
                    (you)
                  </span>
                )}
              </span>
              {participant.user_id === authorId && (
                <Crown
                  aria-label="Host"
                  className="h-4 w-4 shrink-0 fill-primary text-primary"
                />
              )}
              {showValue ? (
                <span
                  className={cn(
                    "min-w-9 rounded-lg border-2 px-2 py-0.5 text-center font-black font-mono",
                    isExtreme
                      ? "border-destructive bg-destructive/10"
                      : "border-primary bg-primary/15"
                  )}
                >
                  {value}
                </span>
              ) : hasVoted ? (
                <span className="flex min-w-9 items-center justify-center gap-1 rounded-lg border-2 border-success bg-success/10 px-2 py-0.5 font-bold text-xs">
                  <Check aria-hidden="true" className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only">Voted</span>
                </span>
              ) : (
                <span className="min-w-9 rounded-lg border-2 border-border border-dashed px-2 py-0.5 text-center text-muted-foreground text-xs">
                  {votesRevealed ? "No vote" : "Thinking"}
                </span>
              )}
            </li>
          );
        })}
        {sortedVoters.length === 0 && (
          <li className="px-3 py-4 text-center text-muted-foreground text-sm">
            Nobody is voting yet. Share the link to invite your team.
          </li>
        )}
      </ul>

      {observers.length > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-muted-foreground text-xs">
          <Glasses aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          Observing: {observers.map((o) => o.username).join(", ")}
        </p>
      )}
    </section>
  );
}
