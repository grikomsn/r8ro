"use client";

import { Crown, Eye, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Participant {
  id: string;
  is_observer?: boolean;
  is_online: boolean;
  user_id: string;
  username: string;
}

interface ParticipantsPanelProps {
  authorId: string;
  className?: string;
  onClose?: () => void;
  participants: Participant[];
  showObservers?: boolean;
}

export function ParticipantsPanel({
  participants,
  authorId,
  onClose,
  showObservers = false,
  className,
}: ParticipantsPanelProps) {
  const displayParticipants = showObservers
    ? participants
    : participants.filter((p) => !p.is_observer);

  const onlineParticipants = displayParticipants.filter((p) => p.is_online);
  const offlineParticipants = displayParticipants.filter((p) => !p.is_online);

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex items-center justify-between gap-2 border-border border-b-2 p-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <h3 className="font-black text-lg uppercase">Participants</h3>
        </div>
        {onClose && (
          <Button
            aria-label="Close participants panel"
            className="h-8 w-8 rounded-lg p-0 lg:hidden"
            onClick={onClose}
            variant="ghost"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {onlineParticipants.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 font-bold text-muted-foreground text-xs uppercase">
              Online ({onlineParticipants.length})
            </p>
            <div className="space-y-2">
              {onlineParticipants.map((participant) => (
                <div
                  className="flex items-center gap-2 rounded-lg border border-border bg-chart-4/20 px-3 py-2"
                  key={participant.id}
                >
                  <div className="h-2 w-2 rounded-full bg-chart-4" />
                  <span className="flex-1 truncate font-semibold text-foreground text-sm">
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
              ))}
            </div>
          </div>
        )}

        {offlineParticipants.length > 0 && (
          <div>
            <p className="mb-2 font-bold text-muted-foreground text-xs uppercase">
              Offline ({offlineParticipants.length})
            </p>
            <div className="space-y-2">
              {offlineParticipants.map((participant) => (
                <div
                  className="flex items-center gap-2 rounded-lg border border-border/30 bg-muted px-3 py-2 opacity-60"
                  key={participant.id}
                >
                  <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                  <span className="flex-1 truncate font-semibold text-foreground text-sm">
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
              ))}
            </div>
          </div>
        )}

        {displayParticipants.length === 0 && (
          <p className="text-center text-muted-foreground text-sm">
            No participants
          </p>
        )}
      </div>
    </div>
  );
}
