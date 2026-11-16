"use client";

import { BarChart3, EyeOff, History } from "lucide-react";
import { useState } from "react";
import { SessionLanding } from "@/components/shared/session-landing";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import {
  VOTING_SCALE_LABELS,
  VOTING_SCALES,
  type VotingScaleType,
} from "@/lib/constants/poker-scales";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  addRecentPokerSession,
  getRecentPokerSessions,
  removeRecentPokerSession,
} from "@/lib/utils/recent-poker-sessions";
import { withSlugRetry } from "@/lib/utils/slug";

const RECENT = {
  add: addRecentPokerSession,
  get: getRecentPokerSessions,
  remove: removeRecentPokerSession,
};

const FEATURES = [
  {
    icon: EyeOff,
    title: "Hidden until reveal",
    description: "Votes stay secret until the host reveals them.",
  },
  {
    icon: BarChart3,
    title: "Instant results",
    description: "Distribution, average, consensus and a suggested estimate.",
  },
  {
    icon: History,
    title: "Round history",
    description: "Every estimated story is kept and can be exported.",
  },
];

const SCALE_TYPES = Object.keys(VOTING_SCALES) as VotingScaleType[];

export default function PokerClientPage() {
  const [scale, setScale] = useState<VotingScaleType>("fibonacci");

  const createSession = async ({
    title,
    userId,
    username,
  }: {
    title: string;
    userId: string;
    username: string;
  }) => {
    const supabase = createClient();
    const finalTitle = title || "Untitled Poker Session";

    const { data, error } = await withSlugRetry(async (slug) => {
      const result = await supabase
        .from("poker_sessions")
        .insert({
          slug,
          title: finalTitle,
          author_id: userId,
          author_name: username,
          voting_scale: [...VOTING_SCALES[scale]],
          is_public: true,
          votes_revealed: false,
          is_voting_active: true,
        })
        .select("id, slug")
        .single();
      return { data: result.data, error: result.error };
    });

    if (error || !data) {
      throw new Error(error?.message || ERROR_MESSAGES.CREATE_FAILED);
    }

    const { error: participantError } = await supabase
      .from("poker_participants")
      .insert({
        session_id: data.id,
        user_id: userId,
        username,
        is_online: true,
        is_observer: false,
      });

    if (participantError) {
      throw new Error(participantError.message || ERROR_MESSAGES.JOIN_FAILED);
    }

    addRecentPokerSession(data.slug, finalTitle);
    return data.slug;
  };

  return (
    <SessionLanding
      createExtras={
        <fieldset className="space-y-2">
          <legend className="mb-2 font-bold text-sm">Voting scale</legend>
          <div className="grid gap-2">
            {SCALE_TYPES.map((type) => (
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-2.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                  scale === type
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/60"
                )}
                key={type}
              >
                <input
                  checked={scale === type}
                  className="sr-only"
                  name="scale"
                  onChange={() => setScale(type)}
                  type="radio"
                  value={type}
                />
                <span className="w-20 shrink-0 font-bold text-sm">
                  {VOTING_SCALE_LABELS[type]}
                </span>
                <span className="min-w-0 truncate font-mono text-muted-foreground text-xs">
                  {VOTING_SCALES[type].join(" · ")}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      }
      createLabel="Start a poker session"
      createSession={createSession}
      description="Estimate stories together without anchoring. Everyone votes in secret, the host reveals, and the result is saved before moving to the next story."
      eyebrow="Planning poker"
      features={FEATURES}
      heading="Estimate as a team, without the bias"
      noun="session"
      pathPrefix="/poker"
      recent={RECENT}
      table="poker_sessions"
      titlePlaceholder="Sprint 42 planning"
    />
  );
}
