"use client";

import { ParticipantsPanel } from "@/components/shared/participants-panel";
import type { RetroParticipant } from "@/lib/types";

interface ParticipantsListProps {
  participants: RetroParticipant[];
  authorId: string;
  onClose?: () => void;
}

export function ParticipantsList({
  participants,
  authorId,
  onClose,
}: ParticipantsListProps) {
  return (
    <ParticipantsPanel
      authorId={authorId}
      onClose={onClose}
      participants={participants}
    />
  );
}
