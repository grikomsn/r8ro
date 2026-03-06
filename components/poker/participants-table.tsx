"use client";

import { Crown, Eye } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PokerParticipant, PokerVote } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ParticipantsTableProps {
  authorId: string;
  currentUserId: string | null;
  isAuthor: boolean;
  participants: PokerParticipant[];
  scale: string[];
  votes: PokerVote[];
  votesRevealed: boolean;
}

export function ParticipantsTable({
  participants,
  votes,
  votesRevealed,
  isAuthor,
  currentUserId,
  authorId,
  scale: _scale,
}: ParticipantsTableProps) {
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const previousRevealState = useRef(votesRevealed);

  useEffect(() => {
    if (votesRevealed && !previousRevealState.current) {
      setLiveAnnouncement(
        `Votes revealed for ${participants.length} participants. ${votes.length} vote${votes.length === 1 ? "" : "s"} submitted.`
      );
    }

    if (!votesRevealed && previousRevealState.current) {
      setLiveAnnouncement("Votes are now hidden.");
    }

    previousRevealState.current = votesRevealed;
  }, [participants.length, votes.length, votesRevealed]);

  // Calculate statistics if votes are revealed
  const calculateStats = () => {
    if (!votesRevealed || votes.length === 0) {
      return null;
    }

    const numericVotes = votes
      .map((v) => {
        const num = Number.parseFloat(v.vote_value);
        return Number.isNaN(num) ? null : num;
      })
      .filter((v): v is number => v !== null);

    if (numericVotes.length === 0) {
      return null;
    }

    const min = Math.min(...numericVotes);
    const max = Math.max(...numericVotes);
    const sum = numericVotes.reduce((a, b) => a + b, 0);
    const avg = sum / numericVotes.length;

    // Find mode
    const frequency: Record<number, number> = {};
    for (const v of numericVotes) {
      frequency[v] = (frequency[v] || 0) + 1;
    }
    const mode = Object.entries(frequency).reduce((a, b) =>
      a[1] > b[1] ? a : b
    )[0];

    // Find outliers (votes > 1.5x away from average)
    const outliers = votes.filter((v) => {
      const num = Number.parseFloat(v.vote_value);
      if (Number.isNaN(num)) {
        return false;
      }
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
    if (!(stats && vote)) {
      return false;
    }
    return stats.outliers.some((o) => o.id === vote.id);
  };

  // Check if user can see vote value
  const canSeeVote = (
    participant: PokerParticipant,
    vote: PokerVote | undefined
  ) => {
    if (!vote) {
      return false;
    }
    if (votesRevealed) {
      return true;
    }
    // Before reveal: admin sees only their own vote
    if (isAuthor && participant.user_id === currentUserId) {
      return true;
    }
    return false;
  };

  return (
    <div className="space-y-4">
      <p aria-live="polite" className="sr-only" role="status">
        {liveAnnouncement}
      </p>
      <h2 className="font-black text-xl uppercase">Participants & Votes</h2>
      <div className="overflow-hidden rounded-xl border-2 border-border bg-background">
        <table className="w-full">
          <thead className="border-border border-b-2 bg-muted">
            <tr>
              <th className="px-4 py-3 text-left font-bold text-sm uppercase">
                Name
              </th>
              <th className="px-4 py-3 text-center font-bold text-sm uppercase">
                Vote
              </th>
              <th className="px-4 py-3 text-center font-bold text-sm uppercase">
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
                  className={cn(
                    "border-border border-b last:border-b-0",
                    participant.is_online
                      ? "bg-background"
                      : "bg-muted/30 opacity-60"
                  )}
                  key={participant.id}
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
                          aria-label="Observer"
                          className="h-4 w-4 text-muted-foreground"
                        />
                      )}
                      {participant.user_id === authorId && (
                        <Crown className="h-4 w-4 fill-primary text-primary" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {showVoteValue && vote ? (
                      <span
                        className={cn(
                          "fade-in zoom-in-95 inline-block animate-in rounded-lg px-3 py-1 font-bold font-mono text-lg duration-300",
                          outlier
                            ? "border-2 border-accent bg-accent/20 text-accent-foreground"
                            : "border-2 border-primary bg-primary/20 text-primary"
                        )}
                      >
                        {vote.vote_value}
                      </span>
                    ) : hasVoted ? (
                      <span className="font-bold text-primary">✓</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {participant.is_online ? (
                      <span className="font-bold text-chart-4 text-xs">
                        Online
                      </span>
                    ) : (
                      <span className="font-bold text-muted-foreground text-xs">
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
        <div
          aria-live="polite"
          className="fade-in slide-in-from-bottom-2 animate-in space-y-2 rounded-xl border-2 border-border bg-muted p-4 duration-300"
          role="status"
        >
          <h3 className="font-black text-lg uppercase">Statistics</h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <p className="font-bold text-muted-foreground text-xs uppercase">
                Min
              </p>
              <p className="font-black text-2xl">{stats.min}</p>
            </div>
            <div>
              <p className="font-bold text-muted-foreground text-xs uppercase">
                Max
              </p>
              <p className="font-black text-2xl">{stats.max}</p>
            </div>
            <div>
              <p className="font-bold text-muted-foreground text-xs uppercase">
                Average
              </p>
              <p className="font-black text-2xl">{stats.avg.toFixed(1)}</p>
            </div>
            <div>
              <p className="font-bold text-muted-foreground text-xs uppercase">
                Mode
              </p>
              <p className="font-black text-2xl">{stats.mode}</p>
            </div>
          </div>
          {stats.outliers.length > 0 && (
            <div className="mt-4 border-border border-t pt-4">
              <p className="font-bold text-accent text-sm">
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
