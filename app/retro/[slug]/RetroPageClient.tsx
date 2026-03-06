"use client";

import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BoardBottomNav } from "@/components/retro/board-bottom-nav";
import { BoardHeader } from "@/components/retro/board-header";
import { JoinModal } from "@/components/retro/join-modal";
import { ParticipantsList } from "@/components/retro/participants-list";
import { PrivateBoardOverlay } from "@/components/retro/private-board-overlay";
import { RetroColumn } from "@/components/retro/retro-column";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import type {
  ColumnType,
  RetroBoard,
  RetroCard,
  RetroParticipant,
} from "@/lib/types";
import { addRecentBoard } from "@/lib/utils/recent-boards";

const DEFAULT_TIMER_DURATION = 300;

interface PresenceState {
  online_at: number;
  user_id: string;
  username: string;
}

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

export default function RetroPageClient() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const { userId, displayName, isInitialized: authInitialized } = useAuth();

  const [board, setBoard] = useState<RetroBoard | null>(null);
  const [cards, setCards] = useState<RetroCard[]>([]);
  const [participants, setParticipants] = useState<RetroParticipant[]>([]);
  const [userName, setUserName] = useState<string | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draggedCard, setDraggedCard] = useState<RetroCard | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [timerDuration, setTimerDuration] = useState(DEFAULT_TIMER_DURATION);
  const [pendingActions, setPendingActions] = useState<Record<string, boolean>>(
    {}
  );

  const boardRef = useRef(board);
  const cardsRef = useRef(cards);
  boardRef.current = board;
  cardsRef.current = cards;

  const isAuthor = board && userId === board.author_id;

  useEffect(() => {
    if (!authInitialized) {
      return;
    }

    if (displayName) {
      setUserName(displayName);
    } else if (userId) {
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
        const { data: boardData, error: boardError } = await supabase
          .from("retro_boards")
          .select("*")
          .eq("slug", slug)
          .maybeSingle();

        if (cancelled) {
          return;
        }

        throwIfSupabaseError(boardError, "Failed to load board");

        if (!boardData) {
          setError("Board not found");
          setLoading(false);
          return;
        }

        setBoard(boardData);
        addRecentBoard(boardData.slug, boardData.title);

        const cardsRes = await supabase
          .from("retro_cards")
          .select("*")
          .eq("board_id", boardData.id)
          .order("created_at", { ascending: true });

        throwIfSupabaseError(cardsRes.error, "Failed to load cards");

        const cardIds = (cardsRes.data || []).map((c) => c.id);
        const [votesRes, participantsRes] = await Promise.all([
          cardIds.length > 0
            ? supabase
                .from("retro_card_votes")
                .select("card_id")
                .in("card_id", cardIds)
            : Promise.resolve({ data: [], error: null }),
          supabase
            .from("retro_participants")
            .select("*")
            .eq("board_id", boardData.id),
        ]);

        if (cancelled) {
          return;
        }

        throwIfSupabaseError(votesRes.error, "Failed to load votes");
        throwIfSupabaseError(
          participantsRes.error,
          "Failed to load participants"
        );

        const voteCounts = new Map<string, number>();
        for (const vote of votesRes.data || []) {
          voteCounts.set(vote.card_id, (voteCounts.get(vote.card_id) || 0) + 1);
        }

        const cardsWithVotes = (cardsRes.data || []).map((card) => ({
          ...card,
          votes: voteCounts.get(card.id) || 0,
        }));

        setCards(cardsWithVotes);
        setParticipants(participantsRes.data || []);

        const existing = participantsRes.data?.find(
          (p) => p.user_id === userId
        );
        if (!existing) {
          const { error: upsertError } = await supabase
            .from("retro_participants")
            .upsert({
              board_id: boardData.id,
              user_id: userId,
              username: userName,
              is_online: true,
            });
          throwIfSupabaseError(upsertError, "Failed to join board");
        }

        if (!cancelled) {
          setLoading(false);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          console.error("Failed to load retro board:", error);
          setError(getErrorMessage(error, "Failed to load board"));
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug, userId, userName]);

  useEffect(() => {
    const boardId = board?.id;
    if (!(boardId && userId && userName)) {
      return;
    }

    const supabase = createClient();
    const channel = supabase.channel(`retro-${slug}`, {
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
          table: "retro_boards",
          filter: `id=eq.${boardId}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE" && payload.new) {
            setBoard(payload.new as RetroBoard);
          } else if (payload.eventType === "DELETE") {
            router.push("/");
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "retro_cards",
          filter: `board_id=eq.${boardId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT" && payload.new) {
            setCards((prev) => {
              const newCard = payload.new as RetroCard;
              const existingIndex = prev.findIndex((c) => c.id === newCard.id);
              if (existingIndex !== -1) {
                const updated = [...prev];
                const preservedVotes = prev[existingIndex]?.votes ?? 0;
                updated[existingIndex] = { ...newCard, votes: preservedVotes };
                return updated;
              }
              return [...prev, { ...newCard, votes: 0 }];
            });
          } else if (payload.eventType === "UPDATE" && payload.new) {
            setCards((prev) =>
              prev.map((c) =>
                c.id === payload.new.id
                  ? { ...(payload.new as RetroCard), votes: c.votes }
                  : c
              )
            );
          } else if (payload.eventType === "DELETE") {
            setCards((prev) => prev.filter((c) => c.id !== payload.old.id));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "retro_card_votes",
        },
        (payload) => {
          const payloadNew = payload.new as { card_id?: string } | null;
          const payloadOld = payload.old as { card_id?: string } | null;
          const cardId = payloadNew?.card_id || payloadOld?.card_id;
          if (!cardId) {
            return;
          }

          const isCardInCurrentBoard = cardsRef.current.some(
            (card) => card.id === cardId
          );
          if (!isCardInCurrentBoard) {
            return;
          }

          if (payload.eventType === "INSERT") {
            setCards((prev) =>
              prev.map((c) =>
                c.id === cardId ? { ...c, votes: c.votes + 1 } : c
              )
            );
          } else if (payload.eventType === "DELETE") {
            setCards((prev) =>
              prev.map((c) =>
                c.id === cardId ? { ...c, votes: Math.max(0, c.votes - 1) } : c
              )
            );
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "retro_participants",
          filter: `board_id=eq.${boardId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT" && payload.new) {
            setParticipants((prev) => {
              const participant = payload.new as RetroParticipant;
              const existingIndex = prev.findIndex(
                (p) => p.id === participant.id
              );
              if (existingIndex !== -1) {
                const updated = [...prev];
                updated[existingIndex] = participant;
                return updated;
              }
              return [...prev, participant];
            });
          } else if (payload.eventType === "UPDATE" && payload.new) {
            setParticipants((prev) =>
              prev.map((part) =>
                part.id === payload.new.id
                  ? (payload.new as RetroParticipant)
                  : part
              )
            );
          } else if (payload.eventType === "DELETE") {
            setParticipants((prev) =>
              prev.filter((part) => part.id !== payload.old.id)
            );
          }
        }
      )
      .on("presence", { event: "sync" }, () => {
        const presenceState = channel.presenceState<PresenceState>();
        const onlineUserIds = new Set<string>();

        for (const key of Object.keys(presenceState)) {
          const presences = presenceState[key];
          if (presences && presences.length > 0) {
            const presence = presences[0] as PresenceState;
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
          .from("retro_participants")
          .update({ is_online: false })
          .eq("user_id", userId)
          .eq("board_id", boardId);
        if (error) {
          console.error("Failed to update participant visibility:", error);
        }
        await channel.untrack();
      } else if (document.visibilityState === "visible") {
        const { error } = await supabase
          .from("retro_participants")
          .update({ is_online: true })
          .eq("user_id", userId)
          .eq("board_id", boardId);
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
        .from("retro_participants")
        .update({ is_online: false })
        .eq("user_id", userId)
        .eq("board_id", boardId);

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
  }, [board?.id, slug, userId, userName, router]);

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
    const b = boardRef.current;
    if (!b || pendingActions.toggleVisibility) {
      return;
    }
    setPendingActions((p) => ({ ...p, toggleVisibility: true }));
    const previousValue = b.is_public;
    setBoard((p) => (p ? { ...p, is_public: !p.is_public } : null));
    try {
      const { error } = await createClient()
        .from("retro_boards")
        .update({ is_public: !b.is_public })
        .eq("id", b.id);
      throwIfSupabaseError(error, "Failed to toggle visibility");
    } catch (error) {
      console.error("Failed to toggle visibility:", error);
      setBoard((p) => (p ? { ...p, is_public: previousValue } : null));
    } finally {
      setPendingActions((p) => ({ ...p, toggleVisibility: false }));
    }
  }, [pendingActions]);

  const handleToggleLock = useCallback(async () => {
    const b = boardRef.current;
    if (!b || pendingActions.toggleLock) {
      return;
    }
    setPendingActions((p) => ({ ...p, toggleLock: true }));
    const previousValue = b.is_locked;
    setBoard((p) => (p ? { ...p, is_locked: !p.is_locked } : null));
    try {
      const { error } = await createClient()
        .from("retro_boards")
        .update({ is_locked: !b.is_locked })
        .eq("id", b.id);
      throwIfSupabaseError(error, "Failed to toggle lock");
    } catch (error) {
      console.error("Failed to toggle lock:", error);
      setBoard((p) => (p ? { ...p, is_locked: previousValue } : null));
    } finally {
      setPendingActions((p) => ({ ...p, toggleLock: false }));
    }
  }, [pendingActions]);

  const handleAddCard = useCallback(
    async (columnType: ColumnType, content: string) => {
      const b = boardRef.current;
      if (!(b && userId && userName) || pendingActions.addCard) {
        return;
      }
      setPendingActions((p) => ({ ...p, addCard: true }));
      const tempId = `temp-${Date.now()}`;
      setCards((p) => [
        ...p,
        {
          id: tempId,
          board_id: b.id,
          column_type: columnType,
          content,
          author_name: userName,
          author_id: userId,
          votes: 0,
          created_at: new Date().toISOString(),
        },
      ]);
      try {
        const { data, error } = await createClient()
          .from("retro_cards")
          .insert({
            board_id: b.id,
            column_type: columnType,
            content,
            author_name: userName,
            author_id: userId,
          })
          .select()
          .single();

        throwIfSupabaseError(error, "Failed to add card");

        if (data) {
          setCards((p) =>
            p.map((c) => (c.id === tempId ? { ...data, votes: 0 } : c))
          );
        } else {
          setCards((p) => p.filter((c) => c.id !== tempId));
        }
      } catch (error) {
        console.error("Failed to add card:", error);
        setCards((p) => p.filter((c) => c.id !== tempId));
      } finally {
        setPendingActions((p) => ({ ...p, addCard: false }));
      }
    },
    [userId, userName, pendingActions]
  );

  const handleVoteCard = useCallback(
    async (cardId: string) => {
      if (!userId || pendingActions[`vote-${cardId}`]) {
        return;
      }

      const actionKey = `vote-${cardId}`;

      setPendingActions((p) => ({ ...p, [actionKey]: true }));

      const supabase = createClient();

      try {
        const { data: existingVote, error: existingVoteError } = await supabase
          .from("retro_card_votes")
          .select("id")
          .eq("card_id", cardId)
          .eq("user_id", userId)
          .maybeSingle();

        throwIfSupabaseError(existingVoteError, "Failed to check vote state");

        if (existingVote) {
          const { error } = await supabase
            .from("retro_card_votes")
            .delete()
            .eq("id", existingVote.id);
          throwIfSupabaseError(error, "Failed to remove vote");
        } else {
          const { error } = await supabase
            .from("retro_card_votes")
            .insert({ card_id: cardId, user_id: userId });
          throwIfSupabaseError(error, "Failed to add vote");
        }
      } catch (error) {
        console.error("Failed to vote on card:", error);
      } finally {
        setPendingActions((p) => ({ ...p, [actionKey]: false }));
      }
    },
    [userId, pendingActions]
  );

  const handleDeleteCard = useCallback(
    async (cardId: string) => {
      if (pendingActions[`delete-${cardId}`]) {
        return;
      }
      const actionKey = `delete-${cardId}`;
      const card = cardsRef.current.find((c) => c.id === cardId);
      const deletedCard = card;

      setPendingActions((p) => ({ ...p, [actionKey]: true }));
      setCards((p) => p.filter((c) => c.id !== cardId));
      try {
        const { error } = await createClient()
          .from("retro_cards")
          .delete()
          .eq("id", cardId);
        throwIfSupabaseError(error, "Failed to delete card");
      } catch (error) {
        console.error("Failed to delete card:", error);
        if (deletedCard) {
          setCards((p) => [...p, deletedCard]);
        }
      } finally {
        setPendingActions((p) => ({ ...p, [actionKey]: false }));
      }
    },
    [pendingActions]
  );

  const handleEditCard = useCallback(
    async (cardId: string, content: string) => {
      if (pendingActions[`edit-${cardId}`]) {
        return;
      }
      const actionKey = `edit-${cardId}`;
      const card = cardsRef.current.find((c) => c.id === cardId);
      const previousContent = card?.content;

      setPendingActions((p) => ({ ...p, [actionKey]: true }));
      setCards((p) => p.map((c) => (c.id === cardId ? { ...c, content } : c)));
      try {
        const { error } = await createClient()
          .from("retro_cards")
          .update({ content })
          .eq("id", cardId);
        throwIfSupabaseError(error, "Failed to edit card");
      } catch (error) {
        console.error("Failed to edit card:", error);
        if (previousContent !== undefined) {
          setCards((p) =>
            p.map((c) =>
              c.id === cardId ? { ...c, content: previousContent } : c
            )
          );
        }
      } finally {
        setPendingActions((p) => ({ ...p, [actionKey]: false }));
      }
    },
    [pendingActions]
  );

  const handleMoveCard = useCallback(
    async (cardId: string, columnType: ColumnType) => {
      if (pendingActions[`move-${cardId}`]) {
        return;
      }
      const actionKey = `move-${cardId}`;
      const card = cardsRef.current.find((c) => c.id === cardId);
      const previousColumn = card?.column_type;

      setPendingActions((p) => ({ ...p, [actionKey]: true }));
      setCards((p) =>
        p.map((c) => (c.id === cardId ? { ...c, column_type: columnType } : c))
      );
      try {
        const { error } = await createClient()
          .from("retro_cards")
          .update({ column_type: columnType })
          .eq("id", cardId);
        throwIfSupabaseError(error, "Failed to move card");
      } catch (error) {
        console.error("Failed to move card:", error);
        if (previousColumn !== undefined) {
          setCards((p) =>
            p.map((c) =>
              c.id === cardId ? { ...c, column_type: previousColumn } : c
            )
          );
        }
      } finally {
        setPendingActions((p) => ({ ...p, [actionKey]: false }));
      }
    },
    [pendingActions]
  );

  const handleEditBoardTitle = useCallback(
    async (title: string) => {
      const b = boardRef.current;
      if (!b || pendingActions.editTitle) {
        return;
      }
      setPendingActions((p) => ({ ...p, editTitle: true }));
      const previousTitle = b.title;
      setBoard((p) => (p ? { ...p, title } : null));
      try {
        const { error } = await createClient()
          .from("retro_boards")
          .update({ title })
          .eq("id", b.id);
        throwIfSupabaseError(error, "Failed to edit board title");
      } catch (error) {
        console.error("Failed to edit board title:", error);
        setBoard((p) => (p ? { ...p, title: previousTitle } : null));
      } finally {
        setPendingActions((p) => ({ ...p, editTitle: false }));
      }
    },
    [pendingActions]
  );

  const handleDeleteBoard = useCallback(async () => {
    const b = boardRef.current;
    if (!b || pendingActions.deleteBoard) {
      return;
    }
    setPendingActions((p) => ({ ...p, deleteBoard: true }));
    try {
      const { error } = await createClient()
        .from("retro_boards")
        .delete()
        .eq("id", b.id);
      throwIfSupabaseError(error, "Failed to delete board");
      router.push("/");
    } catch (error) {
      console.error("Failed to delete board:", error);
    } finally {
      setPendingActions((p) => ({ ...p, deleteBoard: false }));
    }
  }, [router, pendingActions]);

  const handleTimerToggle = useCallback(async () => {
    const b = boardRef.current;
    if (!b || pendingActions.timerToggle) {
      return;
    }
    setPendingActions((p) => ({ ...p, timerToggle: true }));
    const running = !b.timer_running;
    const startedAt = running ? new Date().toISOString() : null;
    const previousRunning = b.timer_running;
    const previousStartedAt = b.timer_started_at;
    setBoard((p) =>
      p ? { ...p, timer_running: running, timer_started_at: startedAt } : null
    );
    try {
      const { error } = await createClient()
        .from("retro_boards")
        .update({ timer_running: running, timer_started_at: startedAt })
        .eq("id", b.id);
      throwIfSupabaseError(error, "Failed to toggle timer");
    } catch (error) {
      console.error("Failed to toggle timer:", error);
      setBoard((p) =>
        p
          ? {
              ...p,
              timer_running: previousRunning,
              timer_started_at: previousStartedAt,
            }
          : null
      );
    } finally {
      setPendingActions((p) => ({ ...p, timerToggle: false }));
    }
  }, [pendingActions]);

  const handleTimerReset = useCallback(async () => {
    const b = boardRef.current;
    if (!b || pendingActions.timerReset) {
      return;
    }
    setPendingActions((p) => ({ ...p, timerReset: true }));
    const previousState = {
      timer_running: b.timer_running,
      timer_seconds: b.timer_seconds,
      timer_started_at: b.timer_started_at,
    };
    setBoard((p) =>
      p
        ? {
            ...p,
            timer_running: false,
            timer_seconds: 300,
            timer_started_at: null,
          }
        : null
    );
    try {
      const { error } = await createClient()
        .from("retro_boards")
        .update({
          timer_running: false,
          timer_seconds: 300,
          timer_started_at: null,
        })
        .eq("id", b.id);
      throwIfSupabaseError(error, "Failed to reset timer");
    } catch (error) {
      console.error("Failed to reset timer:", error);
      setBoard((p) => (p ? { ...p, ...previousState } : null));
    } finally {
      setPendingActions((p) => ({ ...p, timerReset: false }));
    }
  }, [pendingActions]);

  const handleSetTimer = useCallback(
    async (seconds: number) => {
      const b = boardRef.current;
      if (!b || pendingActions.setTimer) {
        return;
      }
      setPendingActions((p) => ({ ...p, setTimer: true }));
      const previousSeconds = b.timer_seconds;
      setTimerDuration(seconds);
      setBoard((p) => (p ? { ...p, timer_seconds: seconds } : null));
      try {
        const { error } = await createClient()
          .from("retro_boards")
          .update({ timer_seconds: seconds })
          .eq("id", b.id);
        throwIfSupabaseError(error, "Failed to set timer");
      } catch (error) {
        console.error("Failed to set timer:", error);
        setTimerDuration(previousSeconds);
        setBoard((p) => (p ? { ...p, timer_seconds: previousSeconds } : null));
      } finally {
        setPendingActions((p) => ({ ...p, setTimer: false }));
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

  if (error || !board) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary">
        <div className="rounded-2xl border-2 border-border bg-background p-8 shadow-md">
          <p className="font-bold text-primary text-xl">
            {error || "Board not found"}
          </p>
          <button
            className="mt-4 underline"
            onClick={() => router.push("/")}
            type="button"
          >
            Go back home
          </button>
        </div>
      </div>
    );
  }

  if (!(board.is_public || isAuthor)) {
    return <PrivateBoardOverlay onGoHome={() => router.push("/")} />;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-secondary">
      <BoardHeader
        board={board}
        currentUserId={userId || ""}
        isAuthor={!!isAuthor}
        onDeleteBoard={handleDeleteBoard}
        onSetTimer={handleSetTimer}
        onTitleUpdate={handleEditBoardTitle}
        onToggleLock={handleToggleLock}
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
        onToggleVisibility={handleToggleVisibility}
        participantCount={participants.length}
        showSidebar={showSidebar}
        timerDuration={timerDuration}
      />
      <div className="relative flex flex-1 overflow-x-hidden">
        <main
          aria-label="Retro board columns"
          className={`flex flex-1 gap-4 overflow-x-auto overflow-y-auto p-4 pb-20 transition-all duration-300 ease-in-out md:gap-6 md:p-6 md:pb-24 ${showSidebar ? "xl:pr-0" : "xl:pr-6"}`}
          data-board-capture
        >
          <div className="min-w-[280px] flex-1 md:min-w-0">
            <RetroColumn
              bgColor="bg-green-600"
              cards={cards.filter((c) => c.column_type === "went_well")}
              columnType="went_well"
              draggedCard={draggedCard}
              isLocked={board.is_locked}
              onAddCard={handleAddCard}
              onDeleteCard={handleDeleteCard}
              onEditCard={handleEditCard}
              onMoveCard={handleMoveCard}
              onVoteCard={(cardId) => handleVoteCard(cardId)}
              pendingActions={pendingActions}
              setDraggedCard={setDraggedCard}
              title="Went Well"
            />
          </div>
          <div className="min-w-[280px] flex-1 md:min-w-0">
            <RetroColumn
              bgColor="bg-red-700"
              cards={cards.filter((c) => c.column_type === "to_improve")}
              columnType="to_improve"
              draggedCard={draggedCard}
              isLocked={board.is_locked}
              onAddCard={handleAddCard}
              onDeleteCard={handleDeleteCard}
              onEditCard={handleEditCard}
              onMoveCard={handleMoveCard}
              onVoteCard={(cardId) => handleVoteCard(cardId)}
              pendingActions={pendingActions}
              setDraggedCard={setDraggedCard}
              title="To Improve"
            />
          </div>
          <div className="min-w-[280px] flex-1 md:min-w-0">
            <RetroColumn
              bgColor="bg-blue-700"
              cards={cards.filter((c) => c.column_type === "action_items")}
              columnType="action_items"
              draggedCard={draggedCard}
              isLocked={board.is_locked}
              onAddCard={handleAddCard}
              onDeleteCard={handleDeleteCard}
              onEditCard={handleEditCard}
              onMoveCard={handleMoveCard}
              onVoteCard={(cardId) => handleVoteCard(cardId)}
              pendingActions={pendingActions}
              setDraggedCard={setDraggedCard}
              title="Action Items"
            />
          </div>
        </main>

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
            <div
              className={`absolute top-0 right-0 bottom-0 mr-[-24px] flex w-[300px] transition-transform duration-300 ease-in-out ${showSidebar ? "translate-x-0" : "translate-x-full"}`}
            >
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

              <aside
                aria-label="Participants sidebar"
                className="flex-1 overflow-hidden rounded-l-xl border-2 border-border border-r-0 bg-background shadow-sm"
                id="participants-sidebar"
              >
                <ParticipantsList
                  authorId={board.author_id || ""}
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
              authorId={board.author_id || ""}
              onClose={() => setShowSidebar(false)}
              participants={participants}
            />
          </aside>
        </TooltipProvider>
      </div>
      <BoardBottomNav
        board={board}
        isAuthor={!!isAuthor}
        onSetTimer={handleSetTimer}
        onTimerReset={handleTimerReset}
        onTimerToggle={handleTimerToggle}
      />
    </div>
  );
}
