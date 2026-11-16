"use client";

import { Crown, Glasses, Users } from "lucide-react";
import { Avatar } from "@/components/shared/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface PresenceParticipant {
  id: string;
  is_observer?: boolean;
  is_online: boolean;
  user_id: string;
  username: string;
}

interface PresenceButtonProps {
  authorId: string;
  currentUserId: string | null;
  participants: PresenceParticipant[];
}

const MAX_FACES = 3;

export function PresenceButton({
  authorId,
  currentUserId,
  participants,
}: PresenceButtonProps) {
  const sorted = [...participants].sort(
    (a, b) =>
      Number(b.is_online) - Number(a.is_online) ||
      Number(b.user_id === authorId) - Number(a.user_id === authorId) ||
      a.username.localeCompare(b.username)
  );
  const online = sorted.filter((p) => p.is_online);
  const offline = sorted.filter((p) => !p.is_online);
  // Your own avatar is already the account button, so the faces show the
  // other people here.
  const faces = online
    .filter((p) => p.user_id !== currentUserId)
    .slice(0, MAX_FACES);

  const renderGroup = (label: string, group: PresenceParticipant[]) =>
    group.length > 0 && (
      <section>
        <h3 className="mb-1.5 px-1 font-bold text-muted-foreground text-xs uppercase tracking-wide">
          {label} · {group.length}
        </h3>
        <ul className="space-y-0.5">
          {group.map((p) => (
            <li
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-1 py-1.5",
                !p.is_online && "opacity-60"
              )}
              key={p.id}
            >
              <Avatar name={p.username} online={p.is_online} size="sm" />
              <span className="min-w-0 flex-1 truncate font-semibold text-sm">
                {p.username}
                {p.user_id === currentUserId && (
                  <span className="ml-1 font-normal text-muted-foreground">
                    (you)
                  </span>
                )}
              </span>
              {p.is_observer && (
                <Glasses
                  aria-label="Observer"
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                />
              )}
              {p.user_id === authorId && (
                <Crown
                  aria-label="Host"
                  className="h-4 w-4 shrink-0 fill-primary text-primary"
                />
              )}
            </li>
          ))}
        </ul>
      </section>
    );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label={`${online.length} of ${participants.length} participants online. Show participants`}
          className="h-9 gap-1.5 rounded-lg px-1.5 sm:pr-2.5"
          variant="ghost"
        >
          <span className="flex">
            {faces.map((p, index) => (
              <Avatar
                className={index > 0 ? "-ml-2 max-sm:hidden" : undefined}
                key={p.id}
                name={p.username}
                size="sm"
              />
            ))}
            {faces.length === 0 && (
              <Users aria-hidden="true" className="mx-1 h-4 w-4" />
            )}
          </span>
          <span className="font-bold text-sm tabular-nums">
            {online.length}
            <span className="hidden font-normal text-muted-foreground sm:inline">
              {" "}
              online
            </span>
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[70dvh] w-72 space-y-3 overflow-y-auto rounded-xl p-3"
      >
        {renderGroup("Online", online)}
        {renderGroup("Away", offline)}
      </PopoverContent>
    </Popover>
  );
}
