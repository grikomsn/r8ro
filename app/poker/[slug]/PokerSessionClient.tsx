"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type {
  PokerSession,
  PokerParticipant,
  PokerVote,
} from "@/lib/types"
import { JoinModal } from "@/components/poker/join-modal"
import { SessionHeader } from "@/components/poker/session-header"
import { VotingCards } from "@/components/poker/voting-cards"
import { ParticipantsTable } from "@/components/poker/participants-table"
import { ParticipantsList } from "@/components/poker/participants-list"
import { PrivateSessionOverlay } from "@/components/poker/private-session-overlay"
import { addRecentPokerSession } from "@/lib/utils/recent-poker-sessions"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip"
import { useAuth } from "@/hooks/use-auth"

export default function PokerSessionClient() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const { userId, displayName, isInitialized: authInitialized } = useAuth()

  const [session, setSession] = useState<PokerSession | null>(null)
  const [participants, setParticipants] = useState<PokerParticipant[]>([])
  const [votes, setVotes] = useState<PokerVote[]>([])
  const [userName, setUserName] = useState<string | null>(null)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showSidebar, setShowSidebar] = useState(true)

  const sessionRef = useRef(session)
  const votesRef = useRef(votes)
  sessionRef.current = session
  votesRef.current = votes

  const isAuthor = session && userId === session.author_id

  useEffect(() => {
    if (!authInitialized) return

    // Use display name from auth, or show join modal if missing
    if (displayName) {
      setUserName(displayName)
    } else if (userId) {
      // User has auth but no display name - show join modal to get name
      setShowJoinModal(true)
      setLoading(false)
    }
  }, [authInitialized, displayName, userId])

  useEffect(() => {
    if (!userId || !userName) return

    let cancelled = false
    const supabase = createClient()

    async function load() {
      const { data: sessionData } = await supabase
        .from("poker_sessions")
        .select("*")
        .eq("slug", slug)
        .single()

      if (cancelled) return
      if (!sessionData) {
        setError("Session not found")
        setLoading(false)
        return
      }

      setSession(sessionData)
      addRecentPokerSession(sessionData.slug, sessionData.title)

      // Load participants and votes
      const [participantsRes, votesRes] = await Promise.all([
        supabase
          .from("poker_participants")
          .select("*")
          .eq("session_id", sessionData.id),
        supabase
          .from("poker_votes")
          .select("*")
          .eq("session_id", sessionData.id),
      ])

      if (cancelled) return

      setParticipants(participantsRes.data || [])
      setVotes(votesRes.data || [])

      const existing = participantsRes.data?.find((p) => p.user_id === userId)
      if (!existing) {
        await supabase
          .from("poker_participants")
          .upsert({
            session_id: sessionData.id,
            user_id: userId,
            username: userName,
            is_online: true,
            is_observer: false,
          })
      }

      if (!cancelled) setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [slug, userId, userName])

  // Set up realtime subscriptions after session is loaded
  useEffect(() => {
    if (!session || !userId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`poker-${slug}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "poker_sessions",
          filter: `id=eq.${session.id}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE" && payload.new) {
            setSession(payload.new as PokerSession)
          } else if (payload.eventType === "DELETE") {
            router.push("/poker")
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "poker_participants",
          filter: `session_id=eq.${session.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT" && payload.new) {
            setParticipants((p) => [...p, payload.new as PokerParticipant])
          } else if (payload.eventType === "UPDATE" && payload.new) {
            setParticipants((p) =>
              p.map((part) =>
                part.id === payload.new.id
                  ? (payload.new as PokerParticipant)
                  : part,
              ),
            )
          } else if (payload.eventType === "DELETE") {
            setParticipants((p) =>
              p.filter((part) => part.id !== payload.old.id),
            )
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "poker_votes",
          filter: `session_id=eq.${session.id}`,
        },
        async (payload) => {
          if (payload.eventType === "INSERT" && payload.new) {
            setVotes((v) => [...v, payload.new as PokerVote])
          } else if (payload.eventType === "UPDATE" && payload.new) {
            setVotes((v) =>
              v.map((vote) =>
                vote.id === payload.new.id
                  ? (payload.new as PokerVote)
                  : vote,
              ),
            )
          } else if (payload.eventType === "DELETE") {
            setVotes((v) =>
              v.filter((vote) => vote.id !== payload.old.id),
            )
          }
        },
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [session, slug, userId, router])

  const handleJoin = useCallback(
    (username: string) => {
      if (!userId) return
      setUserName(username)
      setShowJoinModal(false)
      setLoading(true)
    },
    [userId],
  )

  const handleToggleVisibility = useCallback(async () => {
    const s = sessionRef.current
    if (!s) return
    setSession((p) => (p ? { ...p, is_public: !p.is_public } : null))
    await createClient()
      .from("poker_sessions")
      .update({ is_public: !s.is_public })
      .eq("id", s.id)
  }, [])

  const handleToggleVoting = useCallback(async () => {
    const s = sessionRef.current
    if (!s) return
    setSession((p) => (p ? { ...p, is_voting_active: !p.is_voting_active } : null))
    await createClient()
      .from("poker_sessions")
      .update({ is_voting_active: !s.is_voting_active })
      .eq("id", s.id)
  }, [])

  const handleToggleReveal = useCallback(async () => {
    const s = sessionRef.current
    if (!s) return
    setSession((p) => (p ? { ...p, votes_revealed: !p.votes_revealed } : null))
    await createClient()
      .from("poker_sessions")
      .update({ votes_revealed: !s.votes_revealed })
      .eq("id", s.id)
  }, [])

  const handleClearVotes = useCallback(async () => {
    const s = sessionRef.current
    if (!s || !userId) return
    await createClient()
      .from("poker_votes")
      .delete()
      .eq("session_id", s.id)
    setVotes([])
  }, [userId])

  const handleVote = useCallback(
    async (voteValue: string) => {
      if (!userId || !session) return

      const supabase = createClient()

      // Check if user already voted
      const { data: existingVote } = await supabase
        .from("poker_votes")
        .select("id")
        .eq("session_id", session.id)
        .eq("user_id", userId)
        .single()

      if (existingVote) {
        // Update vote
        await supabase
          .from("poker_votes")
          .update({ vote_value: voteValue })
          .eq("id", existingVote.id)
      } else {
        // Insert new vote
        await supabase
          .from("poker_votes")
          .insert({
            session_id: session.id,
            user_id: userId,
            vote_value: voteValue,
          })
      }
    },
    [userId, session],
  )

  const handleEditSessionTitle = useCallback(async (title: string) => {
    const s = sessionRef.current
    if (!s) return
    setSession((p) => (p ? { ...p, title } : null))
    await createClient().from("poker_sessions").update({ title }).eq("id", s.id)
  }, [])

  const handleEditStory = useCallback(async (story: string) => {
    const s = sessionRef.current
    if (!s) return
    setSession((p) => (p ? { ...p, current_story: story || null } : null))
    await createClient()
      .from("poker_sessions")
      .update({ current_story: story || null })
      .eq("id", s.id)
  }, [])

  const handleDeleteSession = useCallback(async () => {
    const s = sessionRef.current
    if (!s) return
    await createClient().from("poker_sessions").delete().eq("id", s.id)
    router.push("/poker")
  }, [router])

  const handleUpdateScale = useCallback(async (scale: string[]) => {
    const s = sessionRef.current
    if (!s) return
    setSession((p) => (p ? { ...p, voting_scale: scale } : null))
    await createClient()
      .from("poker_sessions")
      .update({ voting_scale: scale })
      .eq("id", s.id)
  }, [])

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
    )
  }

  if (showJoinModal) return <JoinModal onJoin={handleJoin} />

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
    )
  }

  if (error || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary">
        <div className="border-2 border-border bg-background p-8 shadow-md rounded-2xl">
          <p className="text-xl font-bold text-primary">
            {error || "Session not found"}
          </p>
          <button onClick={() => router.push("/poker")} className="mt-4 underline">
            Go back home
          </button>
        </div>
      </div>
    )
  }

  if (!session.is_public && !isAuthor)
    return <PrivateSessionOverlay onGoHome={() => router.push("/poker")} />

  const myVote = votes.find((v) => v.user_id === userId)
  const myParticipant = participants.find((p) => p.user_id === userId)

  return (
    <div className="flex h-screen flex-col bg-secondary overflow-hidden">
      <SessionHeader
        session={session}
        isAuthor={isAuthor || false}
        onToggleVisibility={handleToggleVisibility}
        onToggleVoting={handleToggleVoting}
        onToggleReveal={handleToggleReveal}
        onClearVotes={handleClearVotes}
        onDeleteSession={handleDeleteSession}
        onTitleUpdate={handleEditSessionTitle}
        onStoryUpdate={handleEditStory}
        onUpdateScale={handleUpdateScale}
        showSidebar={showSidebar}
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
        participantCount={participants.length}
        currentUserId={userId}
      />
      <div className="relative flex flex-1 overflow-x-hidden">
        {/* Main content area */}
        <main
          className={`flex flex-1 flex-col gap-6 overflow-y-auto p-4 md:p-6 transition-all duration-300 ease-in-out ${showSidebar ? "xl:pr-0" : "xl:pr-6"}`}
          role="main"
          aria-label="Poker session"
        >
          <VotingCards
            scale={session.voting_scale}
            selectedValue={myVote?.vote_value || null}
            isVotingActive={session.is_voting_active}
            votesRevealed={session.votes_revealed}
            onVote={handleVote}
            isObserver={myParticipant?.is_observer || false}
          />
          <ParticipantsTable
            participants={participants}
            votes={votes}
            votesRevealed={session.votes_revealed}
            isAuthor={isAuthor || false}
            currentUserId={userId}
            authorId={session.author_id}
            scale={session.voting_scale}
          />
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
                  authorId={session.author_id}
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
              authorId={session.author_id}
              onClose={() => setShowSidebar(false)}
            />
          </aside>
        </TooltipProvider>
      </div>
    </div>
  )
}
