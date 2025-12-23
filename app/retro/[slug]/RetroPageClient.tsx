"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type {
  RetroBoard,
  RetroCard,
  RetroParticipant,
  ColumnType,
} from "@/lib/types";
import { JoinModal } from "@/components/retro/join-modal";
import { BoardHeader } from "@/components/retro/board-header";
import { RetroColumn } from "@/components/retro/retro-column";
import { ParticipantsList } from "@/components/retro/participants-list";
import { PrivateBoardOverlay } from "@/components/retro/private-board-overlay";
import { addRecentBoard } from "@/lib/utils/recent-boards";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";

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
    if (!authInitialized) return;

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
    if (!userId || !userName) return;

    let cancelled = false;
    const supabase = createClient();

    async function load() {
      const { data: boardData } = await supabase
        .from("retro_boards")
        .select("*")
        .eq("slug", slug)
        .single();

      if (cancelled) return;
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

      if (cancelled) return;

      // Count votes per card
      const voteCounts = new Map<string, number>();
      (votesRes.data || []).forEach((vote: any) => {
        voteCounts.set(vote.card_id, (voteCounts.get(vote.card_id) || 0) + 1);
      });

      // Transform cards to include vote count
      const cardsWithVotes = (cardsRes.data || []).map((card: any) => ({
        ...card,
        votes: voteCounts.get(card.id) || 0,
      }));

      setCards(cardsWithVotes);
      setParticipants(participantsRes.data || []);

      const existing = participantsRes.data?.find((p) => p.user_id === userId);
      if (!existing) {
        await supabase
          .from("retro_participants")
          .upsert({
            board_id: boardData.id,
            user_id: userId,
            username: userName,
            is_online: true,
          });
      }

      if (!cancelled) setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug, userId, userName]);

  // Set up realtime subscriptions after board is loaded
  useEffect(() => {
    if (!board || !userId) return;

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
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "retro_cards",
          filter: `board_id=eq.${board.id}`,
        },
        async (payload) => {
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
                  : c,
              ),
            );
          } else if (payload.eventType === "DELETE") {
            setCards((p) => p.filter((c) => c.id !== payload.old.id));
          }
        },
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
              p.map((c) => (c.id === cardId ? { ...c, votes: voteCount } : c)),
            );
          }
        },
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
                  : part,
              ),
            );
          } else if (payload.eventType === "DELETE") {
            setParticipants((p) =>
              p.filter((part) => part.id !== payload.old.id),
            );
          }
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [board, slug, userId, router]);

  const handleJoin = useCallback(
    (username: string) => {
      if (!userId) return;
      setUserName(username);
      setShowJoinModal(false);
      setLoading(true);
    },
    [userId],
  );

  const handleToggleVisibility = useCallback(async () => {
    const b = boardRef.current;
    if (!b) return;
    setBoard((p) => (p ? { ...p, is_public: !p.is_public } : null));
    await createClient()
      .from("retro_boards")
      .update({ is_public: !b.is_public })
      .eq("id", b.id);
  }, []);

  const handleToggleLock = useCallback(async () => {
    const b = boardRef.current;
    if (!b) return;
    setBoard((p) => (p ? { ...p, is_locked: !p.is_locked } : null));
    await createClient()
      .from("retro_boards")
      .update({ is_locked: !b.is_locked })
      .eq("id", b.id);
  }, []);

  const handleAddCard = useCallback(
    async (columnType: ColumnType, content: string) => {
      const b = boardRef.current;
      if (!b || !userId || !userName) return;
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
          p.map((c) => (c.id === tempId ? { ...data, votes: 0 } : c)),
        );
      }
    },
    [userId, userName],
  );

  const handleVoteCard = useCallback(
    async (cardId: string) => {
      if (!userId) return;

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
          }),
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
          }),
        );
      }
    },
    [userId],
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
    [],
  );

  const handleMoveCard = useCallback(
    async (cardId: string, columnType: ColumnType) => {
      setCards((p) =>
        p.map((c) => (c.id === cardId ? { ...c, column_type: columnType } : c)),
      );
      await createClient()
        .from("retro_cards")
        .update({ column_type: columnType })
        .eq("id", cardId);
    },
    [],
  );

  const handleEditBoardTitle = useCallback(async (title: string) => {
    const b = boardRef.current;
    if (!b) return;
    setBoard((p) => (p ? { ...p, title } : null));
    await createClient().from("retro_boards").update({ title }).eq("id", b.id);
  }, []);

  const handleDeleteBoard = useCallback(async () => {
    const b = boardRef.current;
    if (!b) return;
    await createClient().from("retro_boards").delete().eq("id", b.id);
    router.push("/");
  }, [router]);

  const handleTimerToggle = useCallback(async () => {
    const b = boardRef.current;
    if (!b) return;
    const running = !b.timer_running;
    const startedAt = running ? new Date().toISOString() : null;
    setBoard((p) =>
      p ? { ...p, timer_running: running, timer_started_at: startedAt } : null,
    );
    await createClient()
      .from("retro_boards")
      .update({ timer_running: running, timer_started_at: startedAt })
      .eq("id", b.id);
  }, []);

  const handleTimerReset = useCallback(async () => {
    const b = boardRef.current;
    if (!b) return;
    setBoard((p) =>
      p
        ? {
            ...p,
            timer_running: false,
            timer_seconds: 300,
            timer_started_at: null,
          }
        : null,
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
    if (!b) return;
    setBoard((p) => (p ? { ...p, timer_seconds: seconds } : null));
    await createClient()
      .from("retro_boards")
      .update({ timer_seconds: seconds })
      .eq("id", b.id);
  }, []);

  if (!authInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary">
        <div className="border-2 border-border bg-background p-8 shadow-md rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-xl font-bold">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (showJoinModal) return <JoinModal onJoin={handleJoin} />;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary">
        <div className="border-2 border-border bg-background p-8 shadow-md rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-xl font-bold">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary">
        <div className="border-2 border-border bg-background p-8 shadow-md rounded-2xl">
          <p className="text-xl font-bold text-primary">
            {error || "Board not found"}
          </p>
          <button onClick={() => router.push("/")} className="mt-4 underline">
            Go back home
          </button>
        </div>
      </div>
    );
  }

  if (!board.is_public && !isAuthor)
    return <PrivateBoardOverlay onGoHome={() => router.push("/")} />;

  return (
    <div className="flex h-screen flex-col bg-secondary overflow-hidden">
      <BoardHeader
        board={board}
        isAuthor={isAuthor || false}
        onToggleVisibility={handleToggleVisibility}
        onToggleLock={handleToggleLock}
        onDeleteBoard={handleDeleteBoard}
        onTimerToggle={handleTimerToggle}
        onTimerReset={handleTimerReset}
        onSetTimer={handleSetTimer}
        onTitleUpdate={handleEditBoardTitle}
        showSidebar={showSidebar}
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
        participantCount={participants.length}
        currentUserId={userId}
      />
      <div className="relative flex flex-1 overflow-x-hidden">
        {/* Main content area */}
        <main
          className={`flex flex-1 gap-4 overflow-x-auto overflow-y-auto p-4 md:gap-6 md:p-6 transition-all duration-300 ease-in-out ${showSidebar ? "xl:pr-0" : "xl:pr-6"}`}
          data-board-capture
          role="main"
          aria-label="Retro board columns"
        >
          <div className="min-w-[280px] flex-1 md:min-w-0">
            <RetroColumn
              title="Went Well"
              columnType="went_well"
              cards={cards.filter((c) => c.column_type === "went_well")}
              currentUserId={userId || ""}
              isLocked={board.is_locked || false}
              bgColor="bg-green-600"
              onAddCard={handleAddCard}
              onVoteCard={(cardId) => handleVoteCard(cardId)}
              onDeleteCard={handleDeleteCard}
              onEditCard={handleEditCard}
              onMoveCard={handleMoveCard}
              draggedCard={draggedCard}
              setDraggedCard={setDraggedCard}
            />
          </div>
          <div className="min-w-[280px] flex-1 md:min-w-0">
            <RetroColumn
              title="To Improve"
              columnType="to_improve"
              cards={cards.filter((c) => c.column_type === "to_improve")}
              currentUserId={userId || ""}
              isLocked={board.is_locked || false}
              bgColor="bg-red-700"
              onAddCard={handleAddCard}
              onVoteCard={(cardId) => handleVoteCard(cardId)}
              onDeleteCard={handleDeleteCard}
              onEditCard={handleEditCard}
              onMoveCard={handleMoveCard}
              draggedCard={draggedCard}
              setDraggedCard={setDraggedCard}
            />
          </div>
          <div className="min-w-[280px] flex-1 md:min-w-0">
            <RetroColumn
              title="Action Items"
              columnType="action_items"
              cards={cards.filter((c) => c.column_type === "action_items")}
              currentUserId={userId || ""}
              isLocked={board.is_locked || false}
              bgColor="bg-blue-700"
              onAddCard={handleAddCard}
              onVoteCard={(cardId) => handleVoteCard(cardId)}
              onDeleteCard={handleDeleteCard}
              onEditCard={handleEditCard}
              onMoveCard={handleMoveCard}
              draggedCard={draggedCard}
              setDraggedCard={setDraggedCard}
            />
          </div>
        </main>

        {/* Mobile overlay backdrop */}
        {showSidebar && (
          <div
            className="fixed inset-0 z-40 bg-foreground/50 xl:hidden"
            onClick={() => setShowSidebar(false)}
            aria-hidden="true"
          />
        )}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className={`fixed top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-6 h-16 transition-all duration-300 ease-in-out rounded-l-lg border-2 border-r-0 border-border bg-background hover:bg-muted shadow-md xl:hidden ${showSidebar ? "right-80" : "right-0"}`}
                aria-label={
                  showSidebar
                    ? "Hide participants sidebar"
                    : "Show participants sidebar"
                }
                aria-expanded={showSidebar}
                aria-controls="participants-sidebar-mobile"
              >
                {showSidebar ? (
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
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

          <div
            className={`hidden xl:block flex-shrink-0 relative transition-[width,margin] duration-300 ease-in-out my-4 md:my-6 mr-6 ${showSidebar ? "w-[300px] ml-2" : "w-0 ml-0"}`}
          >
            {/* Sidebar container - fixed width, uses translate for slide */}
            <div
              className={`absolute right-0 top-0 bottom-0 w-[300px] flex transition-transform duration-300 ease-in-out mr-[-24px] ${showSidebar ? "translate-x-0" : "translate-x-full"}`}
            >
              {/* Toggle button - attached to left edge of sidebar */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowSidebar(!showSidebar)}
                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full z-20 flex items-center justify-center w-5 h-14 rounded-l-md border-2 border-r-0 border-border bg-background hover:bg-muted transition-colors duration-200 shadow-sm"
                    aria-label={
                      showSidebar
                        ? "Hide participants sidebar"
                        : "Show participants sidebar"
                    }
                    aria-expanded={showSidebar}
                    aria-controls="participants-sidebar"
                  >
                    {showSidebar ? (
                      <ChevronRight className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <ChevronLeft className="h-3 w-3" aria-hidden="true" />
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
                className="flex-1 rounded-l-xl border-2 border-r-0 border-border bg-background shadow-sm overflow-hidden"
                role="complementary"
                aria-label="Participants sidebar"
                id="participants-sidebar"
              >
                <ParticipantsList
                  participants={participants}
                  authorId={board.author_id}
                  onClose={() => setShowSidebar(false)}
                />
              </aside>
            </div>
          </div>

          <aside
            className={`fixed right-0 top-0 z-50 h-full w-80 min-w-80 border-l-2 border-border bg-background transition-transform duration-300 ease-in-out xl:hidden ${showSidebar ? "translate-x-0" : "translate-x-full"}`}
            role="complementary"
            aria-label="Participants sidebar"
            aria-hidden={!showSidebar}
            id="participants-sidebar-mobile"
          >
            <ParticipantsList
              participants={participants}
              authorId={board.author_id}
              onClose={() => setShowSidebar(false)}
            />
          </aside>
        </TooltipProvider>
      </div>
    </div>
  );
}
