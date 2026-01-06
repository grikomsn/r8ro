"use client";

import { ParticipantsPanel } from "@/components/shared/participants-panel";
import type { PokerParticipant } from "@/lib/types";

interface ParticipantsListProps {
  participants: PokerParticipant[];
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
      showObservers={true}
    />
  );
}
