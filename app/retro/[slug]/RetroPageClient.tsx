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

  const boardRef = useRef(board);
  const cardsRef = useRef(cards);
  boardRef.current = board;
  cardsRef.current = cards;

  const isAuthor = board && userId === board.author_id;

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
      const { data: boardData } = await supabase
        .from("retro_boards")
        .select("*")
        .eq("slug", slug)
        .single();

      if (cancelled) {
        return;
      }
      if (!boardData) {
        setError("Board not found");
        setLoading(false);
        return;
      }

      setBoard(boardData);
      addRecentBoard(boardData.slug, boardData.title);

      // Load cards first, then votes for those cards
      const cardsRes = await supabase
        .from("retro_cards")
        .select("*")
        .eq("board_id", boardData.id)
        .order("created_at", { ascending: true });

      const cardIds = (cardsRes.data || []).map((c) => c.id);
      const [votesRes, participantsRes] = await Promise.all([
        cardIds.length > 0
          ? supabase
              .from("retro_card_votes")
              .select("card_id")
              .in("card_id", cardIds)
          : Promise.resolve({ data: [] }),
        supabase
          .from("retro_participants")
          .select("*")
          .eq("board_id", boardData.id),
      ]);

      if (cancelled) {
        return;
      }

      // Count votes per card
      const voteCounts = new Map<string, number>();
      for (const vote of votesRes.data || []) {
        voteCounts.set(vote.card_id, (voteCounts.get(vote.card_id) || 0) + 1);
      }

      // Transform cards to include vote count
      const cardsWithVotes = (cardsRes.data || []).map((card) => ({
        ...card,
        votes: voteCounts.get(card.id) || 0,
      }));

      setCards(cardsWithVotes);
      setParticipants(participantsRes.data || []);

      const existing = participantsRes.data?.find((p) => p.user_id === userId);
      if (!existing) {
        await supabase.from("retro_participants").upsert({
          board_id: boardData.id,
          user_id: userId,
          username: userName,
          is_online: true,
        });
      }

      if (!cancelled) {
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug, userId, userName]);

  // Set up realtime subscriptions after board is loaded
  useEffect(() => {
    if (!(board && userId)) {
      return;
    }

    const supabase = createClient();
    const channel = supabase
      .channel(`retro-${slug}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "retro_boards",
          filter: `id=eq.${board.id}`,
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
          filter: `board_id=eq.${board.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT" && payload.new) {
            // New card - add with 0 votes initially
            setCards((p) => [
              ...p,
              { ...(payload.new as RetroCard), votes: 0 },
            ]);
          } else if (payload.eventType === "UPDATE" && payload.new) {
            setCards((p) =>
              p.map((c) =>
                c.id === payload.new.id
                  ? { ...(payload.new as RetroCard), votes: c.votes }
                  : c
              )
            );
          } else if (payload.eventType === "DELETE") {
            setCards((p) => p.filter((c) => c.id !== payload.old.id));
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
        async (payload) => {
          // When votes change, reload vote counts for affected cards
          const cardId = payload.new?.card_id || payload.old?.card_id;
          if (cardId) {
            const { data: votes } = await supabase
              .from("retro_card_votes")
              .select("id")
              .eq("card_id", cardId);

            const voteCount = votes?.length || 0;
            setCards((p) =>
              p.map((c) => (c.id === cardId ? { ...c, votes: voteCount } : c))
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
          filter: `board_id=eq.${board.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT" && payload.new) {
            setParticipants((p) => [...p, payload.new as RetroParticipant]);
          } else if (payload.eventType === "UPDATE" && payload.new) {
            setParticipants((p) =>
              p.map((part) =>
                part.id === payload.new.id
                  ? (payload.new as RetroParticipant)
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
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [board, slug, userId, router]);

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
    if (!b) {
      return;
    }
    setBoard((p) => (p ? { ...p, is_public: !p.is_public } : null));
    await createClient()
      .from("retro_boards")
      .update({ is_public: !b.is_public })
      .eq("id", b.id);
  }, []);

  const handleToggleLock = useCallback(async () => {
    const b = boardRef.current;
    if (!b) {
      return;
    }
    setBoard((p) => (p ? { ...p, is_locked: !p.is_locked } : null));
    await createClient()
      .from("retro_boards")
      .update({ is_locked: !b.is_locked })
      .eq("id", b.id);
  }, []);

  const handleAddCard = useCallback(
    async (columnType: ColumnType, content: string) => {
      const b = boardRef.current;
      if (!(b && userId && userName)) {
        return;
      }
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
      const { data } = await createClient()
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
      if (data) {
        // Add vote count of 0 for new card
        setCards((p) =>
          p.map((c) => (c.id === tempId ? { ...data, votes: 0 } : c))
        );
      }
    },
    [userId, userName]
  );

  const handleVoteCard = useCallback(
    async (cardId: string) => {
      if (!userId) {
        return;
      }

      const supabase = createClient();

      // Check if user already voted
      const { data: existingVote } = await supabase
        .from("retro_card_votes")
        .select("id")
        .eq("card_id", cardId)
        .eq("user_id", userId)
        .single();

      if (existingVote) {
        // Un-vote
        await supabase
          .from("retro_card_votes")
          .delete()
          .eq("id", existingVote.id);
        setCards((p) =>
          p.map((c) => {
            if (c.id === cardId) {
              return { ...c, votes: Math.max(0, c.votes - 1) };
            }
            return c;
          })
        );
      } else {
        // Vote
        await supabase
          .from("retro_card_votes")
          .insert({ card_id: cardId, user_id: userId });
        setCards((p) =>
          p.map((c) => {
            if (c.id === cardId) {
              return { ...c, votes: c.votes + 1 };
            }
            return c;
          })
        );
      }
    },
    [userId]
  );

  const handleDeleteCard = useCallback(async (cardId: string) => {
    setCards((p) => p.filter((c) => c.id !== cardId));
    await createClient().from("retro_cards").delete().eq("id", cardId);
  }, []);

  const handleEditCard = useCallback(
    async (cardId: string, content: string) => {
      setCards((p) => p.map((c) => (c.id === cardId ? { ...c, content } : c)));
      await createClient()
        .from("retro_cards")
        .update({ content })
        .eq("id", cardId);
    },
    []
  );

  const handleMoveCard = useCallback(
    async (cardId: string, columnType: ColumnType) => {
      setCards((p) =>
        p.map((c) => (c.id === cardId ? { ...c, column_type: columnType } : c))
      );
      await createClient()
        .from("retro_cards")
        .update({ column_type: columnType })
        .eq("id", cardId);
    },
    []
  );

  const handleEditBoardTitle = useCallback(async (title: string) => {
    const b = boardRef.current;
    if (!b) {
      return;
    }
    setBoard((p) => (p ? { ...p, title } : null));
    await createClient().from("retro_boards").update({ title }).eq("id", b.id);
  }, []);

  const handleDeleteBoard = useCallback(async () => {
    const b = boardRef.current;
    if (!b) {
      return;
    }
    await createClient().from("retro_boards").delete().eq("id", b.id);
    router.push("/");
  }, [router]);

  const handleTimerToggle = useCallback(async () => {
    const b = boardRef.current;
    if (!b) {
      return;
    }
    const running = !b.timer_running;
    const startedAt = running ? new Date().toISOString() : null;
    setBoard((p) =>
      p ? { ...p, timer_running: running, timer_started_at: startedAt } : null
    );
    await createClient()
      .from("retro_boards")
      .update({ timer_running: running, timer_started_at: startedAt })
      .eq("id", b.id);
  }, []);

  const handleTimerReset = useCallback(async () => {
    const b = boardRef.current;
    if (!b) {
      return;
    }
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
    await createClient()
      .from("retro_boards")
      .update({
        timer_running: false,
        timer_seconds: 300,
        timer_started_at: null,
      })
      .eq("id", b.id);
  }, []);

  const handleSetTimer = useCallback(async (seconds: number) => {
    const b = boardRef.current;
    if (!b) {
      return;
    }
    setBoard((p) => (p ? { ...p, timer_seconds: seconds } : null));
    await createClient()
      .from("retro_boards")
      .update({ timer_seconds: seconds })
      .eq("id", b.id);
  }, []);

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
        currentUserId={userId}
        isAuthor={isAuthor}
        onDeleteBoard={handleDeleteBoard}
        onSetTimer={handleSetTimer}
        onTimerReset={handleTimerReset}
        onTimerToggle={handleTimerToggle}
        onTitleUpdate={handleEditBoardTitle}
        onToggleLock={handleToggleLock}
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
        onToggleVisibility={handleToggleVisibility}
        participantCount={participants.length}
        showSidebar={showSidebar}
      />
      <div className="relative flex flex-1 overflow-x-hidden">
        {/* Main content area */}
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
              currentUserId={userId || ""}
              draggedCard={draggedCard}
              isLocked={board.is_locked}
              onAddCard={handleAddCard}
              onDeleteCard={handleDeleteCard}
              onEditCard={handleEditCard}
              onMoveCard={handleMoveCard}
              onVoteCard={(cardId) => handleVoteCard(cardId)}
              setDraggedCard={setDraggedCard}
              title="Went Well"
            />
          </div>
          <div className="min-w-[280px] flex-1 md:min-w-0">
            <RetroColumn
              bgColor="bg-red-700"
              cards={cards.filter((c) => c.column_type === "to_improve")}
              columnType="to_improve"
              currentUserId={userId || ""}
              draggedCard={draggedCard}
              isLocked={board.is_locked}
              onAddCard={handleAddCard}
              onDeleteCard={handleDeleteCard}
              onEditCard={handleEditCard}
              onMoveCard={handleMoveCard}
              onVoteCard={(cardId) => handleVoteCard(cardId)}
              setDraggedCard={setDraggedCard}
              title="To Improve"
            />
          </div>
          <div className="min-w-[280px] flex-1 md:min-w-0">
            <RetroColumn
              bgColor="bg-blue-700"
              cards={cards.filter((c) => c.column_type === "action_items")}
              columnType="action_items"
              currentUserId={userId || ""}
              draggedCard={draggedCard}
              isLocked={board.is_locked}
              onAddCard={handleAddCard}
              onDeleteCard={handleDeleteCard}
              onEditCard={handleEditCard}
              onMoveCard={handleMoveCard}
              onVoteCard={(cardId) => handleVoteCard(cardId)}
              setDraggedCard={setDraggedCard}
              title="Action Items"
            />
          </div>
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
                  authorId={board.author_id}
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
              authorId={board.author_id}
              onClose={() => setShowSidebar(false)}
              participants={participants}
            />
          </aside>
        </TooltipProvider>
      </div>
      <BoardBottomNav
        board={board}
        isAuthor={isAuthor}
        onSetTimer={handleSetTimer}
        onTimerReset={handleTimerReset}
        onTimerToggle={handleTimerToggle}
      />
    </div>
  );
}
