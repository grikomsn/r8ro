"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { NextRoundDialog } from "@/components/poker/next-round-dialog";
import { RoundHistory } from "@/components/poker/round-history";
import { RoundPanel } from "@/components/poker/round-panel";
import { SessionHeader } from "@/components/poker/session-header";
import { VoteResults } from "@/components/poker/vote-results";
import { VotingCards } from "@/components/poker/voting-cards";
import { AuthErrorNotice } from "@/components/shared/auth-error-notice";
import {
  FullPageLoading,
  FullPageMessage,
} from "@/components/shared/full-page-status";
import { JoinSessionModal } from "@/components/shared/join-session-modal";
import { PrivateAccessOverlay } from "@/components/shared/private-access-overlay";
import { useAuth } from "@/hooks/use-auth";
import { useOrgManagerIds, useOrgRole } from "@/hooks/use-org-role";
import { isOrgManager } from "@/lib/constants/organizations";
import { createClient } from "@/lib/supabase/client";
import type {
  PokerParticipant,
  PokerRound,
  PokerSession,
  PokerVote,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { downloadTextFile } from "@/lib/utils/download";
import {
  getErrorMessage,
  reportActionError,
  throwIfNoRows,
  throwIfSupabaseError,
} from "@/lib/utils/errors";
import { pokerToMarkdown } from "@/lib/utils/export-markdown";
import { computePokerStats } from "@/lib/utils/poker-stats";
import { addRecentPokerSession } from "@/lib/utils/recent-poker-sessions";

interface PresenceState {
  online_at: number;
  user_id: string;
  username: string;
}

function upsertById<T extends { id: string }>(list: T[], item: T) {
  const index = list.findIndex((existing) => existing.id === item.id);
  if (index === -1) {
    return [...list, item];
  }
  const next = [...list];
  next[index] = item;
  return next;
}

function byCreatedAt(a: { created_at: string }, b: { created_at: string }) {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

export default function PokerSessionClient() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const {
    authError,
    userId,
    displayName,
    isInitialized: authInitialized,
  } = useAuth();

  const [session, setSession] = useState<PokerSession | null>(null);
  const [participants, setParticipants] = useState<PokerParticipant[]>([]);
  const [votes, setVotes] = useState<PokerVote[]>([]);
  const [rounds, setRounds] = useState<PokerRound[]>([]);
  const [userName, setUserName] = useState<string | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nextRoundOpen, setNextRoundOpen] = useState(false);
  const [pendingActions, setPendingActions] = useState<Record<string, boolean>>(
    {}
  );

  const sessionRef = useRef(session);
  const votesRef = useRef(votes);
  const participantsRef = useRef(participants);
  const hasSubscribedRef = useRef(false);
  sessionRef.current = session;
  votesRef.current = votes;
  participantsRef.current = participants;

  const isAuthor = !!session && userId === session.author_id;
  // Owners and admins of the organization that owns the session host it too.
  const {
    isLoading: orgRoleLoading,
    organization,
    refresh: refreshOrgRole,
    role: orgRole,
  } = useOrgRole(session?.org_id ?? null);
  const isHost = isAuthor || isOrgManager(orgRole);
  // The member list is readable by members only, so non-members skip it.
  const coHostIds = useOrgManagerIds(organization ? session?.org_id : null);
  // Rounds this client completes are announced by its own success toast, so
  // their realtime INSERT skips the "next story" notice; other hosts still
  // get it. The INSERT can arrive before or after the RPC returns the round
  // id, so both orders are handled, and the in-flight count is released by
  // the RPC itself, never by the event, so a lost event cannot leave it set.
  const ownRoundsInFlightRef = useRef(0);
  const ownRoundIdsRef = useRef(new Set<string>());
  const seenRoundIdsRef = useRef(new Set<string>());

  const setPending = useCallback((key: string, value: boolean) => {
    setPendingActions((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Votes are hidden until the session is revealed, so the list has to be
  // re-read whenever the reveal state changes or the socket reconnects.
  const refetchVotes = useCallback(async (sessionId?: string) => {
    const id = sessionId ?? sessionRef.current?.id;
    if (!id) {
      return;
    }
    const { data, error: fetchError } = await createClient()
      .from("poker_votes")
      .select("*")
      .eq("session_id", id);
    if (fetchError) {
      console.error("Failed to refresh votes:", fetchError);
      return;
    }
    setVotes(data ?? []);
  }, []);

  // Reads the session with its participants, rounds and visible votes in one
  // round trip and applies it. Used on the initial load (by slug) and again
  // whenever the socket reconnects (by id), because Postgres changes are not
  // replayed for a reconnect. RLS applies to every embedded table as usual,
  // so hidden votes stay hidden.
  const loadSnapshot = useCallback(
    async (column: "id" | "slug", value: string) => {
      const { data, error: fetchError } = await createClient()
        .from("poker_sessions")
        .select("*, poker_participants(*), poker_rounds(*), poker_votes(*)")
        .eq(column, value)
        .order("created_at", {
          referencedTable: "poker_rounds",
          ascending: true,
        })
        .maybeSingle();
      throwIfSupabaseError(fetchError, "Failed to load session");

      if (!data) {
        return null;
      }

      const {
        poker_participants: embeddedParticipants,
        poker_rounds: embeddedRounds,
        poker_votes: embeddedVotes,
        ...sessionData
      } = data as PokerSession & {
        poker_participants: PokerParticipant[] | null;
        poker_rounds: PokerRound[] | null;
        poker_votes: PokerVote[] | null;
      };
      const loadedParticipants = embeddedParticipants ?? [];

      setSession(sessionData as PokerSession);
      setParticipants((previous) => {
        const online = new Map(previous.map((p) => [p.user_id, p.is_online]));
        return loadedParticipants.map((p) => ({
          ...p,
          is_online: online.get(p.user_id) ?? p.is_online,
        }));
      });
      setRounds(embeddedRounds ?? []);
      setVotes(embeddedVotes ?? []);

      return {
        participants: loadedParticipants,
        session: sessionData as PokerSession,
      };
    },
    []
  );

  const refetchAll = useCallback(
    async (sessionId: string) =>
      (await loadSnapshot("id", sessionId))?.participants ?? [],
    [loadSnapshot]
  );

  useEffect(() => {
    if (!authInitialized) {
      return;
    }

    if (authError) {
      // The session could not be verified, so the session can never load.
      setLoading(false);
      return;
    }

    if (displayName) {
      setUserName(displayName);
    } else if (userId) {
      setShowJoinModal(true);
      setLoading(false);
    }
  }, [authError, authInitialized, displayName, userId]);

  useEffect(() => {
    if (!(userId && userName)) {
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    async function load() {
      try {
        const loaded = await loadSnapshot("slug", slug);

        if (cancelled) {
          return;
        }

        if (!loaded) {
          setError("not-found");
          setLoading(false);
          return;
        }

        const { session: sessionData, participants: loadedParticipants } =
          loaded;
        addRecentPokerSession(sessionData.slug, sessionData.title);

        const existing = loadedParticipants.find((p) => p.user_id === userId);
        if (!existing) {
          const { error: upsertError } = await supabase
            .from("poker_participants")
            .upsert(
              {
                session_id: sessionData.id,
                user_id: userId,
                username: userName,
                is_online: true,
                is_observer: false,
              },
              {
                onConflict: "session_id,user_id",
                ignoreDuplicates: true,
              }
            );
          throwIfSupabaseError(upsertError, "Failed to join session");
        } else if (existing.username !== userName) {
          // The display name changed since the last visit.
          await supabase
            .from("poker_participants")
            .update({ username: userName })
            .eq("id", existing.id);
        }

        if (!cancelled) {
          setLoading(false);
        }
      } catch (loadError: unknown) {
        if (!cancelled) {
          console.error("Failed to load poker session:", loadError);
          setError(getErrorMessage(loadError, "Failed to load session"));
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug, userId, userName, loadSnapshot]);

  // Set up realtime subscriptions after the session is loaded.
  useEffect(() => {
    const sessionId = session?.id;
    if (!(sessionId && userId && userName)) {
      return;
    }

    const supabase = createClient();
    const channel = supabase.channel(`poker-${slug}`, {
      config: {
        // A private channel is authorised by the realtime.messages policies
        // added in 20261021090900_restrict_presence_channels.sql. Without it
        // any client could read the presence of a session that was made
        // private, because the topic is derived from the slug.
        private: true,
        presence: {
          key: userId,
        },
      },
    });

    const trackPresence = () =>
      channel.track({
        user_id: userId,
        username: userName,
        online_at: Date.now(),
      });

    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "poker_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE" && payload.new) {
            const updated = payload.new as PokerSession;
            const wasRevealed = sessionRef.current?.votes_revealed ?? false;
            setSession(updated);

            // Votes stay hidden until the session is revealed, so the list has
            // to be re-read when the reveal state changes.
            if (wasRevealed !== updated.votes_revealed) {
              refetchVotes(sessionId).catch((refreshError) => {
                console.error("Failed to refresh votes:", refreshError);
              });
            }
          } else if (payload.eventType === "DELETE") {
            toast.info("This session was deleted by the host");
            router.push("/poker");
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "poker_participants",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          if (
            (payload.eventType === "INSERT" ||
              payload.eventType === "UPDATE") &&
            payload.new
          ) {
            const incoming = payload.new as PokerParticipant;
            setParticipants((prev) => {
              // Presence is the source of truth for being online.
              const known = prev.find((p) => p.id === incoming.id);
              return upsertById(
                prev,
                known ? { ...incoming, is_online: known.is_online } : incoming
              );
            });
          } else if (payload.eventType === "DELETE") {
            setParticipants((prev) =>
              prev.filter((part) => part.id !== payload.old.id)
            );
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "poker_votes",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          if (
            (payload.eventType === "INSERT" ||
              payload.eventType === "UPDATE") &&
            payload.new
          ) {
            setVotes((prev) => upsertById(prev, payload.new as PokerVote));
          } else if (payload.eventType === "DELETE") {
            setVotes((prev) => prev.filter((v) => v.id !== payload.old.id));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "poker_rounds",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT" && payload.new) {
            const round = payload.new as PokerRound;
            setRounds((prev) => upsertById(prev, round).sort(byCreatedAt));
            seenRoundIdsRef.current.add(round.id);
            const isOwn =
              ownRoundIdsRef.current.delete(round.id) ||
              ownRoundsInFlightRef.current > 0;
            if (!isOwn) {
              toast.info(
                round.estimate
                  ? `Estimated ${round.estimate}: ${round.story ?? "story"}`
                  : "Round saved",
                { description: "The host started the next story." }
              );
            }
          } else if (payload.eventType === "DELETE") {
            setRounds((prev) => prev.filter((r) => r.id !== payload.old.id));
          }
        }
      )
      .on("presence", { event: "sync" }, () => {
        const presenceState = channel.presenceState<PresenceState>();
        const onlineUserIds = new Set<string>();

        for (const presences of Object.values(presenceState)) {
          const presence = presences?.[0];
          if (presence?.user_id) {
            onlineUserIds.add(presence.user_id);
          }
        }

        setParticipants((prev) =>
          prev.map((part) => ({
            ...part,
            is_online: onlineUserIds.has(part.user_id),
          }))
        );
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await trackPresence();

          // Postgres changes are not replayed for a reconnect, so anything
          // that changed while the socket was down would be missed.
          if (hasSubscribedRef.current) {
            refetchAll(sessionId).catch((refreshError) => {
              console.error("Failed to refresh session:", refreshError);
            });
          }
          hasSubscribedRef.current = true;
        }
      });

    const setOnline = async (isOnline: boolean) => {
      const { error: updateError } = await supabase
        .from("poker_participants")
        .update({ is_online: isOnline })
        .eq("user_id", userId)
        .eq("session_id", sessionId);
      if (updateError) {
        console.error("Failed to update participant status:", updateError);
      }
    };

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "hidden") {
        await setOnline(false);
        await channel.untrack();
      } else if (document.visibilityState === "visible") {
        await setOnline(true);
        await trackPresence();
      }
    };

    const handleBeforeUnload = () => {
      setOnline(false);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      channel.untrack().catch((untrackError) => {
        console.error("Failed to untrack presence:", untrackError);
      });
      channel.unsubscribe();
    };
  }, [session?.id, slug, userId, userName, router, refetchVotes, refetchAll]);

  const handleJoin = useCallback(
    (username: string) => {
      if (!userId) {
        return;
      }
      setUserName(username);
      setShowJoinModal(false);
      setLoading(true);
    },
    [userId]
  );

  /**
   * Applies a session change optimistically, writes it, and rolls back with
   * a visible error if the write is rejected.
   */
  const updateSession = useCallback(
    async (key: string, patch: Partial<PokerSession>, failureLabel: string) => {
      const current = sessionRef.current;
      if (!current) {
        return false;
      }
      const previous: Partial<PokerSession> = {};
      for (const field of Object.keys(patch) as (keyof PokerSession)[]) {
        (previous as Record<string, unknown>)[field] = current[field];
      }

      setPending(key, true);
      setSession((s) => (s ? { ...s, ...patch } : s));
      try {
        const { data: updated, error: updateError } = await createClient()
          .from("poker_sessions")
          .update(patch)
          .eq("id", current.id)
          .select("id");
        throwIfSupabaseError(updateError, failureLabel);
        // Zero rows means you are no longer a host, for example because an
        // organization owner changed your role while the session was open.
        if (!updated || updated.length === 0) {
          refreshOrgRole();
        }
        throwIfNoRows(updated, "You can no longer change this session.");
        return true;
      } catch (updateError) {
        reportActionError(failureLabel, updateError);
        setSession((s) => (s ? { ...s, ...previous } : s));
        return false;
      } finally {
        setPending(key, false);
      }
    },
    [setPending, refreshOrgRole]
  );

  const handleToggleArchive = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) {
      return;
    }
    const archiving = !current.archived_at;
    const ok = await updateSession(
      "archive",
      { archived_at: archiving ? new Date().toISOString() : null },
      archiving
        ? "Could not archive the session"
        : "Could not restore the session"
    );
    if (ok) {
      toast.success(archiving ? "Session archived" : "Session restored", {
        description: archiving
          ? "It moves to Archived in your sessions. Everyone can still open it."
          : "It is back in your active sessions.",
      });
    }
  }, [updateSession]);

  const handleToggleVisibility = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) {
      return;
    }
    const ok = await updateSession(
      "toggleVisibility",
      { is_public: !s.is_public },
      "Could not change visibility"
    );
    if (ok) {
      toast.success(
        s.is_public ? "Session is now private" : "Session is now public"
      );
    }
  }, [updateSession]);

  const handleToggleVoting = useCallback(() => {
    const s = sessionRef.current;
    if (!s) {
      return;
    }
    return updateSession(
      "toggleVoting",
      { is_voting_active: !s.is_voting_active },
      "Could not change voting"
    );
  }, [updateSession]);

  const handleToggleReveal = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) {
      return;
    }
    const ok = await updateSession(
      "toggleReveal",
      { votes_revealed: !s.votes_revealed },
      s.votes_revealed ? "Could not hide votes" : "Could not reveal votes"
    );
    if (ok) {
      await refetchVotes();
    }
  }, [updateSession, refetchVotes]);

  const clearAllVotes = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) {
      return;
    }
    // A direct delete can only remove the caller's own vote, because the
    // delete policy is scoped to the caller's user id. The RPC clears every
    // vote and checks that the caller is a host instead.
    const { error: clearError } = await createClient().rpc(
      "clear_poker_votes",
      { p_session_id: s.id }
    );
    throwIfSupabaseError(clearError, "Failed to clear votes");
  }, []);

  const handleClearVotes = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) {
      return;
    }
    setPending("clearVotes", true);
    const previousVotes = votesRef.current;
    setVotes([]);
    try {
      await clearAllVotes();
      await updateSession(
        "toggleReveal",
        { votes_revealed: false, is_voting_active: true },
        "Could not reopen voting"
      );
      toast.success("Votes cleared", {
        description: "Everyone can vote again.",
      });
    } catch (clearError) {
      reportActionError("Could not clear the votes", clearError);
      setVotes(previousVotes);
      // A refusal can mean you are no longer a host here.
      refreshOrgRole();
    } finally {
      setPending("clearVotes", false);
    }
  }, [clearAllVotes, setPending, updateSession, refreshOrgRole]);

  const handleCompleteRound = useCallback(
    async (estimate: string, nextStory: string) => {
      const s = sessionRef.current;
      if (!s) {
        return;
      }
      setPending("nextRound", true);
      ownRoundsInFlightRef.current += 1;
      try {
        const { data: roundId, error: rpcError } = await createClient().rpc(
          "complete_poker_round",
          {
            p_session_id: s.id,
            p_estimate: estimate,
            p_next_story: nextStory,
          }
        );
        throwIfSupabaseError(rpcError, "Failed to save the round");
        // If the INSERT has not arrived yet, remember the id so that it is
        // recognised as this client's own round when it does.
        if (
          typeof roundId === "string" &&
          !seenRoundIdsRef.current.has(roundId)
        ) {
          ownRoundIdsRef.current.add(roundId);
        }
        setNextRoundOpen(false);
        await refetchAll(s.id);
        toast.success(
          estimate.trim() ? `Saved estimate ${estimate.trim()}` : "Round saved",
          { description: "Voting is open for the next story." }
        );
      } catch (rpcError) {
        reportActionError("Could not save the round", rpcError);
        // A refusal can mean you are no longer a host here.
        refreshOrgRole();
      } finally {
        ownRoundsInFlightRef.current = Math.max(
          0,
          ownRoundsInFlightRef.current - 1
        );
        setPending("nextRound", false);
      }
    },
    [refetchAll, setPending, refreshOrgRole]
  );

  const handleDeleteRound = useCallback(
    async (roundId: string) => {
      let removed: PokerRound | undefined;
      setRounds((prev) => {
        removed = prev.find((r) => r.id === roundId);
        return prev.filter((r) => r.id !== roundId);
      });
      const { data: deleted, error: deleteError } = await createClient()
        .from("poker_rounds")
        .delete()
        .eq("id", roundId)
        .select("id");
      const refused = !deleteError && (!deleted || deleted.length === 0);
      if (refused) {
        refreshOrgRole();
      }
      if (deleteError || refused) {
        reportActionError(
          "Could not delete the round",
          deleteError ?? new Error("You can no longer delete rounds here.")
        );
        const restored = removed;
        if (restored) {
          setRounds((prev) => upsertById(prev, restored).sort(byCreatedAt));
        }
      }
    },
    [refreshOrgRole]
  );

  const handleVote = useCallback(
    async (voteValue: string | null) => {
      const s = sessionRef.current;
      if (!(userId && s)) {
        return;
      }
      const existing = votesRef.current.find((v) => v.user_id === userId);
      const previousVotes = votesRef.current;

      setPending("vote", true);
      if (voteValue === null) {
        setVotes((prev) => prev.filter((v) => v.user_id !== userId));
      } else if (existing) {
        setVotes((prev) =>
          prev.map((v) =>
            v.id === existing.id ? { ...v, vote_value: voteValue } : v
          )
        );
      }

      const supabase = createClient();
      try {
        if (voteValue === null) {
          const { error: deleteError } = await supabase
            .from("poker_votes")
            .delete()
            .eq("session_id", s.id)
            .eq("user_id", userId);
          throwIfSupabaseError(deleteError, "Failed to withdraw vote");
        } else if (existing) {
          const { error: updateError } = await supabase
            .from("poker_votes")
            .update({ vote_value: voteValue })
            .eq("id", existing.id);
          throwIfSupabaseError(updateError, "Failed to change vote");
        } else {
          const { data, error: insertError } = await supabase
            .from("poker_votes")
            .insert({
              session_id: s.id,
              user_id: userId,
              vote_value: voteValue,
            })
            .select()
            .single();
          throwIfSupabaseError(insertError, "Failed to submit vote");
          if (data) {
            setVotes((prev) => upsertById(prev, data as PokerVote));
          }
        }
      } catch (voteError) {
        reportActionError("Could not save your vote", voteError);
        setVotes(previousVotes);
      } finally {
        setPending("vote", false);
      }
    },
    [userId, setPending]
  );

  const handleToggleObserver = useCallback(async () => {
    const s = sessionRef.current;
    const me = participantsRef.current.find((p) => p.user_id === userId);
    if (!(s && me && userId)) {
      return;
    }
    const becomeObserver = !me.is_observer;
    setParticipants((prev) =>
      prev.map((p) =>
        p.id === me.id ? { ...p, is_observer: becomeObserver } : p
      )
    );
    const supabase = createClient();
    try {
      if (becomeObserver) {
        // An observer's vote would still count, so it is withdrawn first.
        await supabase
          .from("poker_votes")
          .delete()
          .eq("session_id", s.id)
          .eq("user_id", userId);
        setVotes((prev) => prev.filter((v) => v.user_id !== userId));
      }
      const { error: updateError } = await supabase
        .from("poker_participants")
        .update({ is_observer: becomeObserver })
        .eq("id", me.id);
      throwIfSupabaseError(updateError, "Failed to change role");
    } catch (roleError) {
      reportActionError("Could not change your role", roleError);
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === me.id ? { ...p, is_observer: !becomeObserver } : p
        )
      );
    }
  }, [userId]);

  const handleEditSessionTitle = useCallback(
    (title: string) =>
      updateSession("editTitle", { title }, "Could not rename the session"),
    [updateSession]
  );

  const handleEditStory = useCallback(
    (story: string) =>
      updateSession(
        "editStory",
        { current_story: story || null },
        "Could not save the story"
      ),
    [updateSession]
  );

  const handleUpdateScale = useCallback(
    async (scale: string[]) => {
      const ok = await updateSession(
        "updateScale",
        { voting_scale: scale },
        "Could not change the scale"
      );
      // Votes cast on the old scale may not exist on the new one.
      if (ok && participantsRef.current.some((p) => p.has_voted)) {
        try {
          await clearAllVotes();
          setVotes([]);
          toast.info("Votes cleared because the scale changed");
        } catch (clearError) {
          reportActionError("Could not clear the old votes", clearError);
        }
      }
    },
    [updateSession, clearAllVotes]
  );

  const handleDeleteSession = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) {
      return;
    }
    setPending("deleteSession", true);
    try {
      const { data: deleted, error: deleteError } = await createClient()
        .from("poker_sessions")
        .delete()
        .eq("id", s.id)
        .select("id");
      throwIfSupabaseError(deleteError, "Failed to delete session");
      if (!deleted || deleted.length === 0) {
        refreshOrgRole();
      }
      throwIfNoRows(deleted, "You can no longer delete this session.");
      toast.success("Session deleted");
      router.push("/poker");
    } catch (deleteError) {
      reportActionError("Could not delete the session", deleteError);
    } finally {
      setPending("deleteSession", false);
    }
  }, [router, setPending, refreshOrgRole]);

  const handleCopyMarkdown = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) {
      return;
    }
    try {
      await navigator.clipboard.writeText(pokerToMarkdown(s, rounds));
      toast.success("Markdown copied");
    } catch (copyError) {
      reportActionError("Could not copy the Markdown", copyError);
    }
  }, [rounds]);

  const handleDownloadMarkdown = useCallback(() => {
    const s = sessionRef.current;
    if (s) {
      downloadTextFile(`${s.slug}-poker.md`, pokerToMarkdown(s, rounds));
    }
  }, [rounds]);

  const suggestion = useMemo(() => {
    if (!session?.votes_revealed || votes.length === 0) {
      return null;
    }
    return computePokerStats(
      session.voting_scale,
      votes.map((v) => ({ value: v.vote_value, voter: v.user_id }))
    ).suggestion;
  }, [session?.votes_revealed, session?.voting_scale, votes]);

  if (!authInitialized) {
    return <FullPageLoading />;
  }

  if (authError) {
    return <AuthErrorNotice message={authError} />;
  }

  if (showJoinModal) {
    return <JoinSessionModal kind="poker" onJoin={handleJoin} slug={slug} />;
  }

  if (loading) {
    return <FullPageLoading label="Loading session…" />;
  }

  if (error || !session) {
    return error && error !== "not-found" ? (
      <FullPageMessage
        description={error}
        homeHref="/poker"
        title="Could not load this session"
      />
    ) : (
      <FullPageMessage
        description={`There is no poker session at “${slug}”. It may have been deleted, or the link may be mistyped.`}
        homeHref="/poker"
        title="Session not found"
      />
    );
  }

  // Existing participants keep access to a session the author made private.
  // The database allows this, so the client gate has to match it.
  const myParticipant = participants.find((p) => p.user_id === userId);

  // Members of the owning organization may open a private session before
  // they have a participant row, so wait for their role instead of flashing
  // the private notice.
  if (
    session.org_id &&
    orgRoleLoading &&
    !(session.is_public || isAuthor || myParticipant)
  ) {
    return <FullPageLoading label="Loading session…" />;
  }

  if (!(session.is_public || isAuthor || myParticipant || orgRole)) {
    return (
      <PrivateAccessOverlay
        description="The host made this session private. Only people who joined before then can open it. Ask the host to make it public again."
        homeHref="/poker"
        title="Private session"
      />
    );
  }

  const myVote = votes.find((v) => v.user_id === userId);
  const voters = participants.filter((p) => !p.is_observer);
  const votedCount = voters.filter(
    (p) => p.has_voted || (p.user_id === userId && myVote)
  ).length;
  const roundNumber = rounds.length + 1;

  const revealed = session.votes_revealed;

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <SessionHeader
        currentUserId={userId}
        isAuthor={isHost}
        isObserver={myParticipant?.is_observer ?? false}
        onCopyMarkdown={handleCopyMarkdown}
        onDeleteSession={handleDeleteSession}
        onDownloadMarkdown={handleDownloadMarkdown}
        onTitleUpdate={handleEditSessionTitle}
        onToggleArchive={handleToggleArchive}
        onToggleObserver={handleToggleObserver}
        onToggleVisibility={handleToggleVisibility}
        onUpdateScale={handleUpdateScale}
        organization={organization}
        participants={participants}
        roundNumber={roundNumber}
        session={session}
      />

      <main
        aria-label="Poker session"
        className={cn(
          "mx-auto grid w-full max-w-6xl flex-1 items-start gap-3 p-3 md:gap-4 md:p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-5",
          isHost && "max-md:pb-24"
        )}
        data-session-capture
      >
        {/* On phones both columns flatten into one list, ordered so the
            results come before the (now inactive) hand once votes are
            revealed. */}
        <div className="grid min-w-0 gap-4 max-lg:contents lg:gap-5">
          <div className="order-1 min-w-0">
            <RoundPanel
              isAuthor={isHost}
              onClearVotes={handleClearVotes}
              onNextRound={() => setNextRoundOpen(true)}
              onStoryUpdate={handleEditStory}
              onToggleReveal={handleToggleReveal}
              onToggleVoting={handleToggleVoting}
              pendingActions={pendingActions}
              roundNumber={roundNumber}
              session={session}
              votedCount={votedCount}
              voterCount={voters.length}
            />
          </div>
          <div className={cn("min-w-0", revealed ? "order-3" : "order-2")}>
            <VotingCards
              isObserver={myParticipant?.is_observer ?? false}
              isPending={!!pendingActions.vote}
              isVotingActive={session.is_voting_active}
              onToggleObserver={handleToggleObserver}
              onVote={handleVote}
              scale={session.voting_scale}
              selectedValue={myVote?.vote_value ?? null}
              votesRevealed={revealed}
            />
          </div>
        </div>
        <div className="grid min-w-0 gap-4 max-lg:contents lg:sticky lg:top-[4.5rem] lg:gap-5">
          <div className={cn("min-w-0", revealed ? "order-2" : "order-3")}>
            <VoteResults
              authorId={session.author_id}
              coHostIds={coHostIds}
              currentUserId={userId}
              participants={participants}
              scale={session.voting_scale}
              votes={votes}
              votesRevealed={revealed}
            />
          </div>
          <div className="order-4 min-w-0">
            <RoundHistory
              canDelete={isHost}
              onDelete={handleDeleteRound}
              rounds={rounds}
            />
          </div>
        </div>
      </main>

      {isHost && (
        <NextRoundDialog
          currentStory={session.current_story}
          isSubmitting={!!pendingActions.nextRound}
          onOpenChange={setNextRoundOpen}
          onSubmit={handleCompleteRound}
          open={nextRoundOpen}
          scale={session.voting_scale}
          suggestion={suggestion}
        />
      )}
    </div>
  );
}
