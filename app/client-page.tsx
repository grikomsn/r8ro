"use client";

import { Lock, ThumbsUp, Timer } from "lucide-react";
import { SessionLanding } from "@/components/shared/session-landing";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { createClient } from "@/lib/supabase/client";
import {
  addRecentBoard,
  getRecentBoards,
  removeRecentBoard,
} from "@/lib/utils/recent-boards";
import { withSlugRetry } from "@/lib/utils/slug";

const DEFAULT_TIMER_SECONDS = 300;

const RECENT = {
  add: addRecentBoard,
  get: getRecentBoards,
  remove: removeRecentBoard,
};

const FEATURES = [
  {
    icon: ThumbsUp,
    title: "Cards and votes",
    description: "Went well, to improve and action items, ranked by votes.",
  },
  {
    icon: Timer,
    title: "Shared timer",
    description: "Timebox each step. Pause, resume and reset for everyone.",
  },
  {
    icon: Lock,
    title: "Lock and export",
    description: "Freeze the board, then export it as Markdown or an image.",
  },
];

async function createRetroBoard({
  title,
  userId,
  username,
}: {
  title: string;
  userId: string;
  username: string;
}) {
  const supabase = createClient();
  const finalTitle = title || "Untitled Retro";

  // The slug space is finite, so a collision is retried with a new slug
  // rather than reported as a raw database error.
  const { data, error } = await withSlugRetry(async (slug) => {
    const result = await supabase
      .from("retro_boards")
      .insert({
        slug,
        title: finalTitle,
        author_id: userId,
        author_name: username,
        is_public: true,
        timer_running: false,
        timer_seconds: DEFAULT_TIMER_SECONDS,
      })
      .select("id, slug")
      .single();
    return { data: result.data, error: result.error };
  });

  if (error || !data) {
    throw new Error(error?.message || ERROR_MESSAGES.CREATE_FAILED);
  }

  const { error: participantError } = await supabase
    .from("retro_participants")
    .insert({
      board_id: data.id,
      user_id: userId,
      username,
      is_online: true,
    });

  if (participantError) {
    throw new Error(participantError.message || ERROR_MESSAGES.JOIN_FAILED);
  }

  addRecentBoard(data.slug, finalTitle);
  return data.slug;
}

export default function RetroClientPage() {
  return (
    <SessionLanding
      createLabel="Start a retro"
      createSession={createRetroBoard}
      description="Collect what went well and what to improve, vote on what matters, and leave with clear action items. No sign-up; share the link and everyone joins in realtime."
      eyebrow="Retrospectives"
      features={FEATURES}
      heading="Run a sprint retro in minutes"
      noun="retro"
      pathPrefix="/retro"
      recent={RECENT}
      table="retro_boards"
      titlePlaceholder="Sprint 42 retro"
    />
  );
}
