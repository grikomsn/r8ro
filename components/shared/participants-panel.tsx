"use client";

import { Crown, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface Participant {
  id: string;
  is_online: boolean;
  user_id: string;
  username: string;
}

interface ParticipantsPanelProps {
  authorId: string;
  className?: string;
  currentUserId: string | null;
  participants: Participant[];
}

function ParticipantRow({
  isAuthor,
  isYou,
  participant,
}: {
  isAuthor: boolean;
  isYou: boolean;
  participant: Participant;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2",
        participant.is_online
          ? "border-border bg-background"
          : "border-transparent bg-muted/60 text-muted-foreground"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          participant.is_online ? "bg-success" : "bg-muted-foreground/50"
        )}
      />
      <span className="min-w-0 flex-1 truncate font-semibold text-sm">
        {participant.username}
        {isYou && (
          <span className="ml-1.5 font-normal text-muted-foreground text-xs">
            (you)
          </span>
        )}
      </span>
      {isAuthor && (
        <Crown
          aria-label="Host"
          className="h-4 w-4 shrink-0 fill-primary text-primary"
        />
      )}
    </li>
  );
}

export function ParticipantsPanel({
  authorId,
  className,
  currentUserId,
  participants,
}: ParticipantsPanelProps) {
  const sorted = [...participants].sort(
    (a, b) =>
      Number(b.is_online) - Number(a.is_online) ||
      Number(b.user_id === authorId) - Number(a.user_id === authorId) ||
      a.username.localeCompare(b.username)
  );
  const online = sorted.filter((p) => p.is_online);
  const offline = sorted.filter((p) => !p.is_online);

  const renderGroup = (label: string, group: Participant[]) =>
    group.length > 0 && (
      <section className="space-y-2">
        <h3 className="font-bold text-muted-foreground text-xs uppercase">
          {label} ({group.length})
        </h3>
        <ul className="space-y-1.5">
          {group.map((participant) => (
            <ParticipantRow
              isAuthor={participant.user_id === authorId}
              isYou={participant.user_id === currentUserId}
              key={participant.id}
              participant={participant}
            />
          ))}
        </ul>
      </section>
    );

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex items-center gap-2 border-border border-b-2 px-4 py-3">
        <Users aria-hidden="true" className="h-5 w-5" />
        <h2 className="font-black text-base uppercase">Participants</h2>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {renderGroup("Online", online)}
        {renderGroup("Offline", offline)}
        {participants.length === 0 && (
          <p className="text-center text-muted-foreground text-sm">
            Nobody has joined yet.
          </p>
        )}
      </div>
    </div>
  );
}
