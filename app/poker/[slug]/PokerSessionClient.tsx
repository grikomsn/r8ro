"use client";

import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { JoinModal } from "@/components/poker/join-modal";
import { ParticipantsList } from "@/components/poker/participants-list";
import { ParticipantsTable } from "@/components/poker/participants-table";
import { PrivateSessionOverlay } from "@/components/poker/private-session-overlay";
import { SessionBottomNav } from "@/components/poker/session-bottom-nav";
import { SessionHeader } from "@/components/poker/session-header";
import { VotingCards } from "@/components/poker/voting-cards";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import type { PokerParticipant, PokerSession, PokerVote } from "@/lib/types";
import { addRecentPokerSession } from "@/lib/utils/recent-poker-sessions";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function throwIfSupabaseError(
  error: { message?: string } | null,
  fallback: string
) {
  if (error) {
    throw new Error(error.message || fallback);
  }
}

export default function PokerSessionClient() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const { userId, displayName, isInitialized: authInitialized } = useAuth();

  const [session, setSession] = useState<PokerSession | null>(null);
  const [participants, setParticipants] = useState<PokerParticipant[]>([]);
  const [votes, setVotes] = useState<PokerVote[]>([]);
  const [userName, setUserName] = useState<string | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);
  const [pendingActions, setPendingActions] = useState<Record<string, boolean>>(
    {}
  );

  const sessionRef = useRef(session);
  const votesRef = useRef(votes);
  sessionRef.current = session;
  votesRef.current = votes;

  const isAuthor = session && userId === session.author_id;

  useEffect(() => {
    if (!authInitialized) {
      return;
    }

    // Use display name from auth, or show join modal if missing
    if (displayName) {
      setUserName(displayName);
    } else if (userId) {
      // User has auth but no display name - show join modal to get name
      setShowJoinModal(true);
      setLoading(false);
    }
  }, [authInitialized, displayName, userId]);

  useEffect(() => {
    if (!(userId && userName)) {
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    async function load() {
      try {
        const { data: sessionData, error: sessionError } = await supabase
          .from("poker_sessions")
          .select("*")
          .eq("slug", slug)
          .maybeSingle();

        if (cancelled) {
          return;
        }

        throwIfSupabaseError(sessionError, "Failed to load session");

        if (!sessionData) {
          setError("Session not found");
          setLoading(false);
          return;
        }

        setSession(sessionData);
        addRecentPokerSession(sessionData.slug, sessionData.title);

        const [participantsRes, votesRes] = await Promise.all([
          supabase
            .from("poker_participants")
            .select("*")
            .eq("session_id", sessionData.id),
          supabase
            .from("poker_votes")
            .select("*")
            .eq("session_id", sessionData.id),
        ]);

        if (cancelled) {
          return;
        }

        throwIfSupabaseError(
          participantsRes.error,
          "Failed to load participants"
        );
        throwIfSupabaseError(votesRes.error, "Failed to load votes");

        setParticipants(participantsRes.data || []);
        setVotes(votesRes.data || []);

        const existing = participantsRes.data?.find(
          (p) => p.user_id === userId
        );
        if (!existing) {
          const { error: upsertError } = await supabase
            .from("poker_participants")
            .upsert({
              session_id: sessionData.id,
              user_id: userId,
              username: userName,
              is_online: true,
              is_observer: false,
            });
          throwIfSupabaseError(upsertError, "Failed to join session");
        }

        if (!cancelled) {
          setLoading(false);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          console.error("Failed to load poker session:", error);
          setError(getErrorMessage(error, "Failed to load session"));
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug, userId, userName]);

  // Set up realtime subscriptions after session is loaded
  useEffect(() => {
    const sessionId = session?.id;
    if (!(sessionId && userId && userName)) {
      return;
    }

    const supabase = createClient();
    const channel = supabase.channel(`poker-${slug}`, {
      config: {
        presence: {
          key: userId,
        },
      },
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
            setSession(payload.new as PokerSession);
          } else if (payload.eventType === "DELETE") {
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
          if (payload.eventType === "INSERT" && payload.new) {
            setParticipants((p) => {
              const participant = payload.new as PokerParticipant;
              const existingIndex = p.findIndex(
                (part) => part.id === participant.id
              );
              if (existingIndex !== -1) {
                const updated = [...p];
                updated[existingIndex] = participant;
                return updated;
              }
              return [...p, participant];
            });
          } else if (payload.eventType === "UPDATE" && payload.new) {
            setParticipants((p) =>
              p.map((part) =>
                part.id === payload.new.id
                  ? (payload.new as PokerParticipant)
                  : part
              )
            );
          } else if (payload.eventType === "DELETE") {
            setParticipants((p) =>
              p.filter((part) => part.id !== payload.old.id)
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
          if (payload.eventType === "INSERT" && payload.new) {
            setVotes((v) => {
              const vote = payload.new as PokerVote;
              const existingIndex = v.findIndex((item) => item.id === vote.id);
              if (existingIndex !== -1) {
                const updated = [...v];
                updated[existingIndex] = vote;
                return updated;
              }
              return [...v, vote];
            });
          } else if (payload.eventType === "UPDATE" && payload.new) {
            setVotes((v) =>
              v.map((vote) =>
                vote.id === payload.new.id ? (payload.new as PokerVote) : vote
              )
            );
          } else if (payload.eventType === "DELETE") {
            setVotes((v) => v.filter((vote) => vote.id !== payload.old.id));
          }
        }
      )
      .on("presence", { event: "sync" }, () => {
        const presenceState = channel.presenceState<{
          user_id: string;
          username: string;
          online_at: number;
        }>();
        const onlineUserIds = new Set<string>();

        for (const key of Object.keys(presenceState)) {
          const presences = presenceState[key];
          if (presences && presences.length > 0) {
            const presence = presences[0];
            if (presence?.user_id) {
              onlineUserIds.add(presence.user_id);
            }
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
          await channel.track({
            user_id: userId,
            username: userName,
            online_at: Date.now(),
          });
        }
      });

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "hidden") {
        const { error } = await supabase
          .from("poker_participants")
          .update({ is_online: false })
          .eq("user_id", userId)
          .eq("session_id", sessionId);
        if (error) {
          console.error("Failed to update participant visibility:", error);
        }
        await channel.untrack();
      } else if (document.visibilityState === "visible") {
        const { error } = await supabase
          .from("poker_participants")
          .update({ is_online: true })
          .eq("user_id", userId)
          .eq("session_id", sessionId);
        if (error) {
          console.error("Failed to update participant visibility:", error);
        }
        await channel.track({
          user_id: userId,
          username: userName,
          online_at: Date.now(),
        });
      }
    };

    const handleBeforeUnload = async () => {
      const { error } = await supabase
        .from("poker_participants")
        .update({ is_online: false })
        .eq("user_id", userId)
        .eq("session_id", sessionId);

      if (error) {
        console.error("Failed to set participant offline:", error);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      channel.untrack().catch((error) => {
        console.error("Failed to untrack presence:", error);
      });
      channel.unsubscribe();
    };
  }, [session?.id, slug, userId, userName, router]);

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

  const handleToggleVisibility = useCallback(async () => {
    const s = sessionRef.current;
    if (!s || pendingActions.toggleVisibility) {
      return;
    }
    setPendingActions((p) => ({ ...p, toggleVisibility: true }));
    const previousValue = s.is_public;
    setSession((p) => (p ? { ...p, is_public: !p.is_public } : null));
    try {
      const { error } = await createClient()
        .from("poker_sessions")
        .update({ is_public: !s.is_public })
        .eq("id", s.id);
      throwIfSupabaseError(error, "Failed to toggle visibility");
    } catch (error) {
      console.error("Failed to toggle visibility:", error);
      setSession((p) => (p ? { ...p, is_public: previousValue } : null));
    } finally {
      setPendingActions((p) => ({ ...p, toggleVisibility: false }));
    }
  }, [pendingActions]);

  const handleToggleVoting = useCallback(async () => {
    const s = sessionRef.current;
    if (!s || pendingActions.toggleVoting) {
      return;
    }
    setPendingActions((p) => ({ ...p, toggleVoting: true }));
    const previousValue = s.is_voting_active;
    setSession((p) =>
      p ? { ...p, is_voting_active: !p.is_voting_active } : null
    );
    try {
      const { error } = await createClient()
        .from("poker_sessions")
        .update({ is_voting_active: !s.is_voting_active })
        .eq("id", s.id);
      throwIfSupabaseError(error, "Failed to toggle voting");
    } catch (error) {
      console.error("Failed to toggle voting:", error);
      setSession((p) => (p ? { ...p, is_voting_active: previousValue } : null));
    } finally {
      setPendingActions((p) => ({ ...p, toggleVoting: false }));
    }
  }, [pendingActions]);

  const handleToggleReveal = useCallback(async () => {
    const s = sessionRef.current;
    if (!s || pendingActions.toggleReveal) {
      return;
    }
    setPendingActions((p) => ({ ...p, toggleReveal: true }));
    const previousValue = s.votes_revealed;
    setSession((p) => (p ? { ...p, votes_revealed: !p.votes_revealed } : null));
    try {
      const { error } = await createClient()
        .from("poker_sessions")
        .update({ votes_revealed: !s.votes_revealed })
        .eq("id", s.id);
      throwIfSupabaseError(error, "Failed to toggle reveal");
    } catch (error) {
      console.error("Failed to toggle reveal:", error);
      setSession((p) => (p ? { ...p, votes_revealed: previousValue } : null));
    } finally {
      setPendingActions((p) => ({ ...p, toggleReveal: false }));
    }
  }, [pendingActions]);

  const handleClearVotes = useCallback(async () => {
    const s = sessionRef.current;
    if (!(s && userId) || pendingActions.clearVotes) {
      return;
    }
    setPendingActions((p) => ({ ...p, clearVotes: true }));
    const previousVotes = votesRef.current;
    setVotes([]);
    try {
      const { error } = await createClient()
        .from("poker_votes")
        .delete()
        .eq("session_id", s.id);
      throwIfSupabaseError(error, "Failed to clear votes");
    } catch (error) {
      console.error("Failed to clear votes:", error);
      setVotes(previousVotes);
    } finally {
      setPendingActions((p) => ({ ...p, clearVotes: false }));
    }
  }, [userId, pendingActions]);

  const handleVote = useCallback(
    async (voteValue: string) => {
      const s = sessionRef.current;
      if (!(userId && s) || pendingActions.vote) {
        return;
      }
      setPendingActions((p) => ({ ...p, vote: true }));
      const supabase = createClient();

      try {
        const { data: existingVote, error: existingVoteError } = await supabase
          .from("poker_votes")
          .select("id")
          .eq("session_id", s.id)
          .eq("user_id", userId)
          .maybeSingle();

        throwIfSupabaseError(existingVoteError, "Failed to check vote state");

        if (existingVote) {
          const { error } = await supabase
            .from("poker_votes")
            .update({ vote_value: voteValue })
            .eq("id", existingVote.id);
          throwIfSupabaseError(error, "Failed to update vote");
        } else {
          const { error } = await supabase.from("poker_votes").insert({
            session_id: s.id,
            user_id: userId,
            vote_value: voteValue,
          });
          throwIfSupabaseError(error, "Failed to submit vote");
        }
      } catch (error) {
        console.error("Failed to submit vote:", error);
      } finally {
        setPendingActions((p) => ({ ...p, vote: false }));
      }
    },
    [userId, pendingActions]
  );

  const handleEditSessionTitle = useCallback(
    async (title: string) => {
      const s = sessionRef.current;
      if (!s || pendingActions.editTitle) {
        return;
      }
      setPendingActions((p) => ({ ...p, editTitle: true }));
      const previousTitle = s.title;
      setSession((p) => (p ? { ...p, title } : null));
      try {
        const { error } = await createClient()
          .from("poker_sessions")
          .update({ title })
          .eq("id", s.id);
        throwIfSupabaseError(error, "Failed to edit session title");
      } catch (error) {
        console.error("Failed to edit session title:", error);
        setSession((p) => (p ? { ...p, title: previousTitle } : null));
      } finally {
        setPendingActions((p) => ({ ...p, editTitle: false }));
      }
    },
    [pendingActions]
  );

  const handleEditStory = useCallback(
    async (story: string) => {
      const s = sessionRef.current;
      if (!s || pendingActions.editStory) {
        return;
      }
      setPendingActions((p) => ({ ...p, editStory: true }));
      const previousStory = s.current_story;
      setSession((p) => (p ? { ...p, current_story: story || null } : null));
      try {
        const { error } = await createClient()
          .from("poker_sessions")
          .update({ current_story: story || null })
          .eq("id", s.id);
        throwIfSupabaseError(error, "Failed to edit story");
      } catch (error) {
        console.error("Failed to edit story:", error);
        setSession((p) => (p ? { ...p, current_story: previousStory } : null));
      } finally {
        setPendingActions((p) => ({ ...p, editStory: false }));
      }
    },
    [pendingActions]
  );

  const handleDeleteSession = useCallback(async () => {
    const s = sessionRef.current;
    if (!s || pendingActions.deleteSession) {
      return;
    }
    setPendingActions((p) => ({ ...p, deleteSession: true }));
    try {
      const { error } = await createClient()
        .from("poker_sessions")
        .delete()
        .eq("id", s.id);
      throwIfSupabaseError(error, "Failed to delete session");
      router.push("/poker");
    } catch (error) {
      console.error("Failed to delete session:", error);
    } finally {
      setPendingActions((p) => ({ ...p, deleteSession: false }));
    }
  }, [router, pendingActions]);

  const handleUpdateScale = useCallback(
    async (scale: string[]) => {
      const s = sessionRef.current;
      if (!s || pendingActions.updateScale) {
        return;
      }
      setPendingActions((p) => ({ ...p, updateScale: true }));
      const previousScale = s.voting_scale;
      setSession((p) => (p ? { ...p, voting_scale: scale } : null));
      try {
        const { error } = await createClient()
          .from("poker_sessions")
          .update({ voting_scale: scale })
          .eq("id", s.id);
        throwIfSupabaseError(error, "Failed to update scale");
      } catch (error) {
        console.error("Failed to update scale:", error);
        setSession((p) => (p ? { ...p, voting_scale: previousScale } : null));
      } finally {
        setPendingActions((p) => ({ ...p, updateScale: false }));
      }
    },
    [pendingActions]
  );

  if (!authInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary">
        <div className="rounded-2xl border-2 border-border bg-background p-8 shadow-md">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="font-bold text-xl">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (showJoinModal) {
    return <JoinModal onJoin={handleJoin} />;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary">
        <div className="rounded-2xl border-2 border-border bg-background p-8 shadow-md">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="font-bold text-xl">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary">
        <div className="rounded-2xl border-2 border-border bg-background p-8 shadow-md">
          <p className="font-bold text-primary text-xl">
            {error || "Session not found"}
          </p>
          <button
            className="mt-4 underline"
            onClick={() => router.push("/poker")}
            type="button"
          >
            Go back home
          </button>
        </div>
      </div>
    );
  }

  if (!(session.is_public || isAuthor)) {
    return <PrivateSessionOverlay onGoHome={() => router.push("/poker")} />;
  }

  const myVote = votes.find((v) => v.user_id === userId);
  const myParticipant = participants.find((p) => p.user_id === userId);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-secondary">
      <SessionHeader
        currentUserId={userId ?? undefined}
        isAuthor={isAuthor ?? false}
        onDeleteSession={handleDeleteSession}
        onStoryUpdate={handleEditStory}
        onTitleUpdate={handleEditSessionTitle}
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
        onToggleVisibility={handleToggleVisibility}
        onUpdateScale={handleUpdateScale}
        participantCount={participants.length}
        session={session}
        showSidebar={showSidebar}
      />
      <div className="relative flex flex-1 overflow-x-hidden">
        {/* Main content area */}
        <main
          aria-label="Poker session"
          className={`flex flex-1 flex-col gap-6 overflow-y-auto p-4 transition-all duration-300 ease-in-out md:p-6 ${showSidebar ? "xl:pr-0" : "xl:pr-6"}`}
          data-session-capture
        >
          <VotingCards
            isObserver={myParticipant?.is_observer ?? false}
            isVotingActive={session.is_voting_active}
            onVote={handleVote}
            scale={session.voting_scale}
            selectedValue={myVote?.vote_value || null}
            votesRevealed={session.votes_revealed}
          />
          <ParticipantsTable
            authorId={session.author_id}
            currentUserId={userId ?? null}
            isAuthor={isAuthor ?? false}
            participants={participants}
            scale={session.voting_scale}
            votes={votes}
            votesRevealed={session.votes_revealed}
          />
        </main>

        {/* Mobile overlay backdrop */}
        {showSidebar && (
          <div
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-foreground/50 xl:hidden"
            onClick={() => setShowSidebar(false)}
          />
        )}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                aria-controls="participants-sidebar-mobile"
                aria-expanded={showSidebar}
                aria-label={
                  showSidebar
                    ? "Hide participants sidebar"
                    : "Show participants sidebar"
                }
                className={`fixed top-1/2 z-50 flex h-16 w-6 -translate-y-1/2 items-center justify-center rounded-l-lg border-2 border-border border-r-0 bg-background shadow-md transition-all duration-300 ease-in-out hover:bg-muted xl:hidden ${showSidebar ? "right-80" : "right-0"}`}
                onClick={() => setShowSidebar(!showSidebar)}
                type="button"
              >
                <Users aria-hidden="true" className="h-4 w-4" />
                <span className="sr-only">
                  {showSidebar ? "Hide sidebar" : "Show sidebar"}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">
              {showSidebar ? "Hide sidebar" : "Show sidebar"}
            </TooltipContent>
          </Tooltip>

          <div
            className={`relative my-4 mr-6 hidden flex-shrink-0 transition-[width,margin] duration-300 ease-in-out md:my-6 xl:block ${showSidebar ? "ml-2 w-[300px]" : "ml-0 w-0"}`}
          >
            {/* Sidebar container - fixed width, uses translate for slide */}
            <div
              className={`absolute top-0 right-0 bottom-0 mr-[-24px] flex w-[300px] transition-transform duration-300 ease-in-out ${showSidebar ? "translate-x-0" : "translate-x-full"}`}
            >
              {/* Toggle button - attached to left edge of sidebar */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    aria-controls="participants-sidebar"
                    aria-expanded={showSidebar}
                    aria-label={
                      showSidebar
                        ? "Hide participants sidebar"
                        : "Show participants sidebar"
                    }
                    className="absolute top-1/2 left-0 z-20 flex h-14 w-5 -translate-x-full -translate-y-1/2 items-center justify-center rounded-l-md border-2 border-border border-r-0 bg-background shadow-sm transition-colors duration-200 hover:bg-muted"
                    onClick={() => setShowSidebar(!showSidebar)}
                    type="button"
                  >
                    {showSidebar ? (
                      <ChevronRight aria-hidden="true" className="h-3 w-3" />
                    ) : (
                      <ChevronLeft aria-hidden="true" className="h-3 w-3" />
                    )}
                    <span className="sr-only">
                      {showSidebar ? "Hide sidebar" : "Show sidebar"}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  {showSidebar ? "Hide sidebar" : "Show sidebar"}
                </TooltipContent>
              </Tooltip>

              {/* Sidebar content */}
              <aside
                aria-label="Participants sidebar"
                className="flex-1 overflow-hidden rounded-l-xl border-2 border-border border-r-0 bg-background shadow-sm"
                id="participants-sidebar"
              >
                <ParticipantsList
                  authorId={session.author_id}
                  onClose={() => setShowSidebar(false)}
                  participants={participants}
                />
              </aside>
            </div>
          </div>

          <aside
            aria-hidden={!showSidebar}
            aria-label="Participants sidebar"
            className={`fixed top-0 right-0 z-50 h-full w-80 min-w-80 border-border border-l-2 bg-background transition-transform duration-300 ease-in-out xl:hidden ${showSidebar ? "translate-x-0" : "translate-x-full"}`}
            id="participants-sidebar-mobile"
          >
            <ParticipantsList
              authorId={session.author_id}
              onClose={() => setShowSidebar(false)}
              participants={participants}
            />
          </aside>
        </TooltipProvider>
      </div>
      {isAuthor && (
        <SessionBottomNav
          isAuthor={isAuthor}
          onClearVotes={handleClearVotes}
          onToggleReveal={handleToggleReveal}
          onToggleVoting={handleToggleVoting}
          session={session}
        />
      )}
    </div>
  );
}
