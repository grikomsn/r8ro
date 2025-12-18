"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { RetroBoard, RetroCard, RetroParticipant, ColumnType } from "@/lib/types"
import { JoinModal } from "@/components/retro/join-modal"
import { BoardHeader } from "@/components/retro/board-header"
import { RetroColumn } from "@/components/retro/retro-column"
import { ParticipantsList } from "@/components/retro/participants-list"
import { PrivateBoardOverlay } from "@/components/retro/private-board-overlay"
import { addRecentBoard } from "@/lib/utils/recent-boards"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { useAuth } from "@/hooks/use-auth"
import { DatabaseError, NotFoundError, AuthenticationError, getErrorMessage } from "@/lib/utils/errors"
import { SkeletonBoardHeader, SkeletonColumn } from "@/components/ui/skeleton-card"

export default function RetroPageClient() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const { userId, displayName, isInitialized: authInitialized } = useAuth()

  const [board, setBoard] = useState<RetroBoard | null>(null)
  const [cards, setCards] = useState<RetroCard[]>([])
  const [participants, setParticipants] = useState<RetroParticipant[]>([])
  const [userName, setUserName] = useState<string | null>(null)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [draggedCard, setDraggedCard] = useState<RetroCard | null>(null)
  const [showSidebar, setShowSidebar] = useState(true)

  const boardRef = useRef(board)
  const cardsRef = useRef(cards)
  boardRef.current = board
  cardsRef.current = cards

  const isAuthor = board && userId === board.author_id

  useEffect(() => {
    if (!authInitialized) return

    // Check URL params for shared links
    const urlParams = new URLSearchParams(window.location.search)
    const unameParam = urlParams.get("uname")

    if (unameParam) {
      setUserName(unameParam)
      window.history.replaceState({}, "", window.location.pathname)
    } else if (displayName) {
      setUserName(displayName)
    } else if (userId) {
      // User has auth but no display name - show join modal to get name
      setShowJoinModal(true)
      setLoading(false)
    }
  }, [authInitialized, displayName, userId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const supabase = createClient()

    async function load() {
      try {
        if (!userId) {
          throw new AuthenticationError("User not authenticated")
        }

        const { data: boardData, error: boardError } = await supabase
          .from("retro_boards")
          .select(
            "id, slug, title, author_id, author_name, is_public, is_locked, timer_running, timer_seconds, timer_started_at",
          )
          .eq("slug", slug)
          .single()

        if (cancelled) return

        if (boardError) {
          if (boardError.code === "PGRST116") {
            throw new NotFoundError("Board", { slug })
          }
          throw new DatabaseError("Failed to load board", { error: boardError })
        }

        if (!boardData) {
          throw new NotFoundError("Board", { slug })
        }

        setBoard(boardData)
        addRecentBoard(boardData.slug, boardData.title)

        const [cardsRes, participantsRes] = await Promise.all([
          supabase
            .from("retro_cards")
            .select("id, board_id, column_type, content, author_name, author_id, votes, created_at")
            .eq("board_id", boardData.id)
            .order("created_at", { ascending: true }),
          supabase
            .from("retro_participants")
            .select("id, board_id, user_id, username, is_online, cursor_x, cursor_y, last_seen")
            .eq("board_id", boardData.id),
        ])

        if (cancelled) return

        if (cardsRes.error) {
          throw new DatabaseError("Failed to load cards", { error: cardsRes.error })
        }

        if (participantsRes.error) {
          throw new DatabaseError("Failed to load participants", { error: participantsRes.error })
        }

        setCards(cardsRes.data || [])
        setParticipants(participantsRes.data || [])

        const existing = participantsRes.data?.find((p) => p.user_id === userId)
        if (!existing && userName) {
          const { error: upsertError } = await supabase
            .from("retro_participants")
            .upsert({ board_id: boardData.id, user_id: userId, username: userName, is_online: true })

          if (upsertError) {
            console.error("Failed to join as participant:", upsertError)
          }
        }

        if (!cancelled) setLoading(false)
      } catch (err) {
        if (!cancelled) {
          const errorMessage = getErrorMessage(err)
          setError(errorMessage)
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [slug, userId, userName])

  useEffect(() => {
    if (!board?.id) return

    const supabase = createClient()

    // Subscribe to cards changes
    const cardsChannel = supabase
      .channel(`retro_cards:board_id=eq.${board.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "retro_cards",
          filter: `board_id=eq.${board.id}`,
        },
        (payload) => {
          setCards((prev) => [...prev, payload.new as RetroCard])
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "retro_cards",
          filter: `board_id=eq.${board.id}`,
        },
        (payload) => {
          setCards((prev) => prev.map((card) => (card.id === payload.new.id ? (payload.new as RetroCard) : card)))
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "retro_cards",
          filter: `board_id=eq.${board.id}`,
        },
        (payload) => {
          setCards((prev) => prev.filter((card) => card.id !== payload.old.id))
        },
      )
      .subscribe()

    // Subscribe to participants changes
    const participantsChannel = supabase
      .channel(`retro_participants:board_id=eq.${board.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "retro_participants",
          filter: `board_id=eq.${board.id}`,
        },
        (payload) => {
          setParticipants((prev) => {
            const exists = prev.find((p) => p.user_id === (payload.new as RetroParticipant).user_id)
            if (exists) return prev
            return [...prev, payload.new as RetroParticipant]
          })
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "retro_participants",
          filter: `board_id=eq.${board.id}`,
        },
        (payload) => {
          setParticipants((prev) =>
            prev.map((p) => (p.user_id === payload.new.user_id ? (payload.new as RetroParticipant) : p)),
          )
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "retro_participants",
          filter: `board_id=eq.${board.id}`,
        },
        (payload) => {
          setParticipants((prev) => prev.filter((p) => p.user_id !== payload.old.user_id))
        },
      )
      .subscribe()

    // Subscribe to board changes (title, lock status, visibility, timer)
    const boardChannel = supabase
      .channel(`retro_boards:id=eq.${board.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "retro_boards",
          filter: `id=eq.${board.id}`,
        },
        (payload) => {
          setBoard(payload.new as RetroBoard)
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "retro_boards",
          filter: `id=eq.${board.id}`,
        },
        () => {
          router.push("/")
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(cardsChannel)
      supabase.removeChannel(participantsChannel)
      supabase.removeChannel(boardChannel)
    }
  }, [board?.id, router])

  const handleJoin = useCallback(
    (username: string) => {
      if (!userId) return
      setUserName(username)
      setShowJoinModal(false)
      setLoading(true)
    },
    [userId],
  )

  const handleTogglePublic = useCallback(async () => {
    const b = boardRef.current
    if (!b) return
    setBoard((p) => (p ? { ...p, is_public: !p.is_public } : null))
    const { error } = await createClient().from("retro_boards").update({ is_public: !b.is_public }).eq("id", b.id)
    if (error) {
      console.error("Failed to toggle public status:", error)
      // Revert optimistic update
      setBoard((p) => (p ? { ...p, is_public: b.is_public } : null))
    }
  }, [])

  const handleToggleLock = useCallback(async () => {
    const b = boardRef.current
    if (!b) return
    setBoard((p) => (p ? { ...p, is_locked: !p.is_locked } : null))
    const { error } = await createClient().from("retro_boards").update({ is_locked: !b.is_locked }).eq("id", b.id)
    if (error) {
      console.error("Failed to toggle lock status:", error)
      setBoard((p) => (p ? { ...p, is_locked: b.is_locked } : null))
    }
  }, [])

  const handleAddCard = useCallback(
    async (columnType: ColumnType, content: string) => {
      const b = boardRef.current
      if (!b || !userId || !userName) {
        console.error("Missing required data for adding card")
        return
      }

      const tempId = `temp-${Date.now()}`
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
      ])

      try {
        const { data, error } = await createClient()
          .from("retro_cards")
          .insert({
            board_id: b.id,
            column_type: columnType,
            content,
            author_name: userName,
            author_id: userId,
            votes: 0,
          })
          .select("id, board_id, column_type, content, author_name, author_id, votes, created_at")
          .single()

        if (error) {
          throw new DatabaseError("Failed to add card", { error })
        }

        if (data) {
          setCards((p) => p.map((c) => (c.id === tempId ? data : c)))
        }
      } catch (err) {
        console.error("Failed to add card:", err)
        // Remove optimistic card on error
        setCards((p) => p.filter((c) => c.id !== tempId))
      }
    },
    [userId, userName],
  )

  const handleVoteCard = useCallback(async (cardId: string, votes: number) => {
    if (!cardId) {
      console.error("Invalid card ID for voting")
      return
    }

    const newVotes = votes + 1
    setCards((p) => p.map((c) => (c.id === cardId ? { ...c, votes: newVotes } : c)))

    try {
      const { error } = await createClient().from("retro_cards").update({ votes: newVotes }).eq("id", cardId)

      if (error) {
        throw new DatabaseError("Failed to vote on card", { error })
      }
    } catch (err) {
      console.error("Failed to vote card:", err)
      // Revert optimistic update
      setCards((p) => p.map((c) => (c.id === cardId ? { ...c, votes } : c)))
    }
  }, [])

  const handleDeleteCard = useCallback(async (cardId: string) => {
    if (!cardId) {
      console.error("Invalid card ID for deletion")
      return
    }

    // Store the card in case we need to restore it
    const deletedCard = cardsRef.current.find((c) => c.id === cardId)
    setCards((p) => p.filter((c) => c.id !== cardId))

    try {
      const { error } = await createClient().from("retro_cards").delete().eq("id", cardId)

      if (error) {
        throw new DatabaseError("Failed to delete card", { error })
      }
    } catch (err) {
      console.error("Failed to delete card:", err)
      // Restore card on error
      if (deletedCard) {
        setCards((p) => [...p, deletedCard])
      }
    }
  }, [])

  const handleEditCard = useCallback(async (cardId: string, content: string) => {
    if (!cardId || content === undefined) {
      console.error("Invalid parameters for card edit")
      return
    }

    const originalContent = cardsRef.current.find((c) => c.id === cardId)?.content
    setCards((p) => p.map((c) => (c.id === cardId ? { ...c, content } : c)))

    try {
      const { error } = await createClient().from("retro_cards").update({ content }).eq("id", cardId)

      if (error) {
        throw new DatabaseError("Failed to edit card", { error })
      }
    } catch (err) {
      console.error("Failed to edit card:", err)
      // Revert to original content
      if (originalContent !== undefined) {
        setCards((p) => p.map((c) => (c.id === cardId ? { ...c, content: originalContent } : c)))
      }
    }
  }, [])

  const handleMoveCard = useCallback(async (cardId: string, columnType: ColumnType) => {
    const originalColumn = cardsRef.current.find((c) => c.id === cardId)?.column_type
    setCards((p) => p.map((c) => (c.id === cardId ? { ...c, column_type: columnType } : c)))
    const { error } = await createClient().from("retro_cards").update({ column_type: columnType }).eq("id", cardId)

    if (error) {
      console.error("Failed to move card:", error)
      // Revert to original column
      if (originalColumn) {
        setCards((p) => p.map((c) => (c.id === cardId ? { ...c, column_type: originalColumn } : c)))
      }
    }
  }, [])

  const handleEditBoardTitle = useCallback(async (title: string) => {
    const b = boardRef.current
    if (!b) return
    const originalTitle = b.title
    setBoard((p) => (p ? { ...p, title } : null))
    const { error } = await createClient().from("retro_boards").update({ title }).eq("id", b.id)

    if (error) {
      console.error("Failed to edit board title:", error)
      setBoard((p) => (p ? { ...p, title: originalTitle } : null))
    }
  }, [])

  const handleDeleteBoard = useCallback(async () => {
    const b = boardRef.current
    if (!b) return
    const { error } = await createClient().from("retro_boards").delete().eq("id", b.id)

    if (error) {
      console.error("Failed to delete board:", error)
      return
    }

    router.push("/")
  }, [router])

  const handleTimerToggle = useCallback(async () => {
    const b = boardRef.current
    if (!b) return
    const running = !b.timer_running
    const startedAt = running ? new Date().toISOString() : null
    setBoard((p) => (p ? { ...p, timer_running: running, timer_started_at: startedAt } : null))
    const { error } = await createClient()
      .from("retro_boards")
      .update({ timer_running: running, timer_started_at: startedAt })
      .eq("id", b.id)

    if (error) {
      console.error("Failed to toggle timer:", error)
      setBoard((p) => (p ? { ...p, timer_running: b.timer_running, timer_started_at: b.timer_started_at } : null))
    }
  }, [])

  const handleTimerReset = useCallback(async () => {
    const b = boardRef.current
    if (!b) return
    setBoard((p) => (p ? { ...p, timer_running: false, timer_seconds: 300, timer_started_at: null } : null))
    const { error } = await createClient()
      .from("retro_boards")
      .update({ timer_running: false, timer_seconds: 300, timer_started_at: null })
      .eq("id", b.id)

    if (error) {
      console.error("Failed to reset timer:", error)
      setBoard((p) =>
        p
          ? {
              ...p,
              timer_running: b.timer_running,
              timer_seconds: b.timer_seconds,
              timer_started_at: b.timer_started_at,
            }
          : null,
      )
    }
  }, [])

  const handleSetTimer = useCallback(async (seconds: number) => {
    const b = boardRef.current
    if (!b) return
    const originalSeconds = b.timer_seconds
    setBoard((p) => (p ? { ...p, timer_seconds: seconds } : null))
    const { error } = await createClient().from("retro_boards").update({ timer_seconds: seconds }).eq("id", b.id)

    if (error) {
      console.error("Failed to set timer:", error)
      setBoard((p) => (p ? { ...p, timer_seconds: originalSeconds } : null))
    }
  }, [])

  if (!authInitialized) {
    return (
      <div className="flex min-h-screen flex-col bg-secondary">
        <SkeletonBoardHeader />
        <div className="flex-1 p-4 md:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SkeletonColumn />
            <SkeletonColumn />
            <SkeletonColumn />
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-secondary">
        <SkeletonBoardHeader />
        <div className="flex-1 p-4 md:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SkeletonColumn />
            <SkeletonColumn />
            <SkeletonColumn />
          </div>
        </div>
      </div>
    )
  }

  if (showJoinModal) return <JoinModal onJoin={handleJoin} />

  if (error || !board) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary">
        <div className="border-2 border-border bg-background p-8 shadow-md rounded-2xl">
          <p className="text-xl font-bold text-primary">{error || "Board not found"}</p>
          <button onClick={() => router.push("/")} className="mt-4 underline">
            Go back home
          </button>
        </div>
      </div>
    )
  }

  if (!board.is_public && !isAuthor) return <PrivateBoardOverlay onGoHome={() => router.push("/")} />

  return (
    <div className="flex h-screen flex-col bg-secondary overflow-hidden">
      <BoardHeader
        board={board}
        isAuthor={isAuthor || false}
        onToggleVisibility={handleTogglePublic}
        onToggleLock={handleToggleLock}
        onDeleteBoard={handleDeleteBoard}
        onTimerToggle={handleTimerToggle}
        onTimerReset={handleTimerReset}
        onSetTimer={handleSetTimer}
        onEditTitle={handleEditBoardTitle}
        showSidebar={showSidebar}
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
        participantCount={participants.length}
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
              onVoteCard={handleVoteCard}
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
              onVoteCard={handleVoteCard}
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
              onVoteCard={handleVoteCard}
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
                aria-label={showSidebar ? "Hide participants sidebar" : "Show participants sidebar"}
                aria-expanded={showSidebar}
                aria-controls="participants-sidebar-mobile"
              >
                {showSidebar ? (
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                )}
                <span className="sr-only">{showSidebar ? "Hide sidebar" : "Show sidebar"}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">{showSidebar ? "Hide sidebar" : "Show sidebar"}</TooltipContent>
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
                    aria-label={showSidebar ? "Hide participants sidebar" : "Show participants sidebar"}
                    aria-expanded={showSidebar}
                    aria-controls="participants-sidebar"
                  >
                    {showSidebar ? (
                      <ChevronRight className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <ChevronLeft className="h-3 w-3" aria-hidden="true" />
                    )}
                    <span className="sr-only">{showSidebar ? "Hide sidebar" : "Show sidebar"}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">{showSidebar ? "Hide sidebar" : "Show sidebar"}</TooltipContent>
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
  )
}
