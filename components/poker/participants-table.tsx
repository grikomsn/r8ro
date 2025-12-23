"use client";

import type { PokerParticipant, PokerVote } from "@/lib/types";
import { Crown, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface ParticipantsTableProps {
  participants: PokerParticipant[];
  votes: PokerVote[];
  votesRevealed: boolean;
  isAuthor: boolean;
  currentUserId: string | null;
  authorId: string;
  scale: string[];
}

export function ParticipantsTable({
  participants,
  votes,
  votesRevealed,
  isAuthor,
  currentUserId,
  authorId,
  scale,
}: ParticipantsTableProps) {
  // Calculate statistics if votes are revealed
  const calculateStats = () => {
    if (!votesRevealed || votes.length === 0) return null;

    const numericVotes = votes
      .map((v) => {
        const num = Number.parseFloat(v.vote_value);
        return isNaN(num) ? null : num;
      })
      .filter((v): v is number => v !== null);

    if (numericVotes.length === 0) return null;

    const min = Math.min(...numericVotes);
    const max = Math.max(...numericVotes);
    const sum = numericVotes.reduce((a, b) => a + b, 0);
    const avg = sum / numericVotes.length;

    // Find mode
    const frequency: Record<number, number> = {};
    numericVotes.forEach((v) => {
      frequency[v] = (frequency[v] || 0) + 1;
    });
    const mode = Object.entries(frequency).reduce((a, b) =>
      a[1] > b[1] ? a : b
    )[0];

    // Find outliers (votes > 1.5x away from average)
    const outliers = votes.filter((v) => {
      const num = Number.parseFloat(v.vote_value);
      if (isNaN(num)) return false;
      return Math.abs(num - avg) > avg * 1.5;
    });

    return { min, max, avg, mode: Number.parseFloat(mode), outliers };
  };

  const stats = calculateStats();

  // Get vote for each participant
  const getParticipantVote = (participant: PokerParticipant) => {
    return votes.find((v) => v.user_id === participant.user_id);
  };

  // Check if vote is outlier
  const isOutlier = (vote: PokerVote | undefined) => {
    if (!stats || !vote) return false;
    return stats.outliers.some((o) => o.id === vote.id);
  };

  // Check if user can see vote value
  const canSeeVote = (
    participant: PokerParticipant,
    vote: PokerVote | undefined
  ) => {
    if (!vote) return false;
    if (votesRevealed) return true;
    // Before reveal: admin sees only their own vote
    if (isAuthor && participant.user_id === currentUserId) return true;
    return false;
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-black uppercase">Participants & Votes</h2>
      <div className="rounded-xl border-2 border-border bg-background overflow-hidden">
        <table className="w-full">
          <thead className="border-b-2 border-border bg-muted">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-bold uppercase">
                Name
              </th>
              <th className="px-4 py-3 text-center text-sm font-bold uppercase">
                Vote
              </th>
              <th className="px-4 py-3 text-center text-sm font-bold uppercase">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {participants.map((participant) => {
              const vote = getParticipantVote(participant);
              const hasVoted = !!vote;
              const showVoteValue = canSeeVote(participant, vote);
              const outlier = isOutlier(vote);

              return (
                <tr
                  key={participant.id}
                  className={cn(
                    "border-b border-border last:border-b-0",
                    participant.is_online
                      ? "bg-background"
                      : "bg-muted/30 opacity-60"
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full",
                          participant.is_online
                            ? "bg-chart-4"
                            : "bg-muted-foreground"
                        )}
                      />
                      <span className="font-semibold">
                        {participant.username}
                      </span>
                      {participant.is_observer && (
                        <Eye
                          className="h-4 w-4 text-muted-foreground"
                          aria-label="Observer"
                        />
                      )}
                      {participant.user_id === authorId && (
                        <Crown className="h-4 w-4 text-amber-600 fill-amber-500" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {showVoteValue && vote ? (
                      <span
                        className={cn(
                          "inline-block px-3 py-1 rounded-lg font-mono font-bold text-lg",
                          outlier
                            ? "bg-amber-100 text-amber-900 border-2 border-amber-500"
                            : "bg-primary/20 text-primary border-2 border-primary"
                        )}
                      >
                        {vote.vote_value}
                      </span>
                    ) : hasVoted ? (
                      <span className="text-primary font-bold">✓</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {participant.is_online ? (
                      <span className="text-xs font-bold text-chart-4">
                        Online
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-muted-foreground">
                        Offline
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {votesRevealed && stats && (
        <div className="rounded-xl border-2 border-border bg-muted p-4 space-y-2">
          <h3 className="text-lg font-black uppercase">Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs font-bold uppercase text-muted-foreground">
                Min
              </p>
              <p className="text-2xl font-black">{stats.min}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-muted-foreground">
                Max
              </p>
              <p className="text-2xl font-black">{stats.max}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-muted-foreground">
                Average
              </p>
              <p className="text-2xl font-black">{stats.avg.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-muted-foreground">
                Mode
              </p>
              <p className="text-2xl font-black">{stats.mode}</p>
            </div>
          </div>
          {stats.outliers.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm font-bold text-amber-600">
                {stats.outliers.length} outlier
                {stats.outliers.length > 1 ? "s" : ""} detected
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
