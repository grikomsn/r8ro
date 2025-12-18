"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createClient } from "@/lib/supabase/client"
import { generateSlug } from "@/lib/utils/slug"
import { History, X, Plus, LogIn } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { getRecentBoards, addRecentBoard, removeRecentBoard, type RecentBoard } from "@/lib/utils/recent-boards"
import { UserAccountPopover } from "@/components/auth/user-account-popover"

export default function ClientPage() {
  const router = useRouter()
  const { userId, displayName, updateDisplayName, isLoading: authLoading, isInitialized } = useAuth()
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [username, setUsername] = useState("")
  const [createForm, setCreateForm] = useState({ title: "" })
  const [joinForm, setJoinForm] = useState({ slug: "" })
  const [error, setError] = useState("")
  const [recentBoards, setRecentBoards] = useState<RecentBoard[]>([])

  useEffect(() => {
    if (isInitialized && displayName) {
      setUsername(displayName)
    }
  }, [isInitialized, displayName])

  useEffect(() => {
    setRecentBoards(getRecentBoards())
  }, [])

  const handleRemoveRecent = (slug: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    removeRecentBoard(slug)
    setRecentBoards(getRecentBoards())
  }

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) {
      setError("Please enter your name")
      return
    }
    if (!userId) {
      setError("Authentication not ready. Please wait...")
      return
    }

    setIsCreating(true)
    setError("")

    try {
      const supabase = createClient()
      const slug = generateSlug()

      if (username.trim() !== displayName) {
        await updateDisplayName(username.trim())
      }

      const boardData = {
        slug,
        title: createForm.title.trim() || "Untitled Retro",
        author_id: userId,
        author_name: username.trim(),
        is_public: true,
        timer_running: false,
        timer_seconds: 0,
      }

      const { error: insertError } = await supabase.from("retro_boards").insert(boardData)

      if (insertError) {
        throw new Error(insertError.message || "Failed to create board")
      }

      const { data: boardDataResult, error: boardError } = await supabase
        .from("retro_boards")
        .select("id")
        .eq("slug", slug)
        .single()

      if (boardError || !boardDataResult) {
        throw new Error(boardError?.message || "Failed to fetch created board")
      }

      const { error: participantError } = await supabase.from("retro_participants").insert({
        board_id: boardDataResult.id,
        user_id: userId,
        username: username.trim(),
        is_online: true,
      })

      if (participantError) {
        throw new Error(participantError.message || "Failed to join as participant")
      }

      addRecentBoard(slug, createForm.title.trim() || "Untitled Retro")
      router.push(`/retro/${slug}`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create session. Please try again."
      setError(errorMessage)
    } finally {
      setIsCreating(false)
    }
  }

  const handleJoinSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinForm.slug.trim() || !username.trim()) {
      setError("Please fill in all fields")
      return
    }
    if (!userId) {
      setError("Authentication not ready. Please wait...")
      return
    }

    setIsJoining(true)
    setError("")

    try {
      const supabase = createClient()
      const { data: board, error: fetchError } = await supabase
        .from("retro_boards")
        .select("id, is_public, title")
        .eq("slug", joinForm.slug.trim().toLowerCase())
        .single()

      if (fetchError || !board) {
        setError("Session not found. Check the URL and try again.")
        return
      }

      if (username.trim() !== displayName) {
        await updateDisplayName(username.trim())
      }

      addRecentBoard(joinForm.slug.trim().toLowerCase(), board.title)
      router.push(`/retro/${joinForm.slug.trim().toLowerCase()}`)
    } catch (err) {
      console.error(err)
      setError("Failed to join session. Please try again.")
    } finally {
      setIsJoining(false)
    }
  }

  if (!isInitialized) {
    return (
      <main className="min-h-screen bg-secondary p-4 md:p-8 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-foreground/60">Loading...</p>
        </div>
      </main>
    )
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "r8ro",
            description:
              "Real-time collaborative retrospective tool for agile teams. Create sessions, brainstorm, vote, and improve together.",
            url: "https://r8ro.app",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
            },
            featureList: [
              "Real-time collaboration",
              "Session timer controls",
              "Voting on retrospective items",
              "Public and private board modes",
              "Drag and drop cards",
              "Live cursors",
            ],
            browserRequirements: "Requires JavaScript. Requires HTML5.",
          }),
        }}
      />
      <main className="min-h-screen bg-secondary flex flex-col">
        {/* Header with branding and account */}
        <header className="border-b-2 border-border bg-background">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <h1 className="text-2xl font-black uppercase tracking-tight font-mono">
              r<span className="text-primary">8</span>ro
            </h1>
            {userId && <UserAccountPopover />}
          </div>
        </header>

        {/* Main content area */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
          <div className="w-full max-w-2xl space-y-6">
            {/* Recent boards section */}
            {recentBoards.length > 0 && (
              <Card className="rounded-2xl border-2 border-border shadow-md overflow-hidden p-0 gap-0">
                <div className="border-b-2 border-border bg-muted px-6 py-4 flex items-center gap-2">
                  <History className="h-5 w-5" />
                  <h2 className="text-base font-bold uppercase">Recent</h2>
                </div>
                <CardContent className="p-4">
                  <div className="grid gap-2">
                    {recentBoards.map((board) => (
                      <a
                        key={board.slug}
                        href={`/retro/${board.slug}`}
                        className="group flex items-center justify-between rounded-xl border-2 border-border bg-background px-4 py-3 font-bold shadow-sm transition-all hover:shadow-md hover:border-primary"
                      >
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="truncate">{board.title}</span>
                          <span className="text-xs text-muted-foreground font-mono">{board.slug}</span>
                        </div>
                        <button
                          onClick={(e) => handleRemoveRecent(board.slug, e)}
                          className="ml-2 opacity-0 transition-opacity group-hover:opacity-100 shrink-0"
                          aria-label="Remove from recent"
                        >
                          <X className="h-4 w-4 text-muted-foreground hover:text-primary" />
                        </button>
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Main action card */}
            <Card className="rounded-2xl shadow-lg overflow-hidden p-0 gap-0 border-0">
              <CardContent className="p-0">
                <Tabs defaultValue="create" className="w-full">
                  <TabsList className="grid h-auto w-full grid-cols-2 p-0 rounded-tl-2xl rounded-tr-2xl bg-muted">
                    <TabsTrigger
                      value="create"
                      className="rounded-tl-xl rounded-tr-none rounded-br-none rounded-bl-none border-2 border-border py-4 text-base font-bold uppercase data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:text-foreground gap-2"
                    >
                      <Plus className="h-5 w-5" />
                      Create
                    </TabsTrigger>
                    <TabsTrigger
                      value="join"
                      className="rounded-tl-none rounded-tr-xl rounded-br-none rounded-bl-none border-2 border-border py-4 text-base font-bold uppercase data-[state=active]:border-accent data-[state=active]:bg-background data-[state=active]:text-foreground gap-2"
                    >
                      <LogIn className="h-5 w-5" />
                      Join
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="create" className="p-6 md:p-8 mt-0">
                    <form onSubmit={handleCreateSession} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="create-username" className="text-sm font-bold uppercase">
                          Your Name
                        </Label>
                        <Input
                          id="create-username"
                          placeholder="Enter your name"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="h-12 rounded-xl border-2 border-border bg-background px-4 text-base shadow-sm"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="create-title" className="text-sm font-bold uppercase text-muted-foreground">
                          Session Title <span className="text-xs">(Optional)</span>
                        </Label>
                        <Input
                          id="create-title"
                          placeholder="Sprint 42 Retro"
                          value={createForm.title}
                          onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                          className="h-12 rounded-xl border-2 border-border bg-background px-4 text-base shadow-sm"
                        />
                      </div>
                      {error && (
                        <div className="rounded-xl border-2 border-primary/20 bg-primary/10 px-4 py-3">
                          <p className="text-sm font-bold text-primary">{error}</p>
                        </div>
                      )}
                      <Button
                        type="submit"
                        disabled={isCreating || authLoading || !userId}
                        variant="default"
                        size="xl"
                        className="w-full border-2 border-border font-bold uppercase shadow-md transition-all hover:shadow-lg rounded-xl"
                      >
                        {isCreating ? "Creating..." : "Start New Retro"}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="join" className="p-6 md:p-8 mt-0">
                    <form onSubmit={handleJoinSession} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="join-username" className="text-sm font-bold uppercase">
                          Your Name
                        </Label>
                        <Input
                          id="join-username"
                          placeholder="Enter your name"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="h-12 rounded-xl border-2 border-border bg-background px-4 text-base shadow-sm"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="join-slug" className="text-sm font-bold uppercase">
                          Session Code
                        </Label>
                        <Input
                          id="join-slug"
                          placeholder="swift-falcon-123"
                          value={joinForm.slug}
                          onChange={(e) => setJoinForm({ ...joinForm, slug: e.target.value })}
                          className="h-12 rounded-xl border-2 border-border bg-background px-4 text-base font-mono shadow-sm"
                          required
                        />
                      </div>
                      {error && (
                        <div className="rounded-xl border-2 border-primary/20 bg-primary/10 px-4 py-3">
                          <p className="text-sm font-bold text-primary">{error}</p>
                        </div>
                      )}
                      <Button
                        type="submit"
                        disabled={isJoining || authLoading || !userId}
                        variant="default"
                        size="xl"
                        className="w-full border-2 border-border font-bold uppercase shadow-md transition-all hover:shadow-lg rounded-xl"
                      >
                        {isJoining ? "Joining..." : "Join Session"}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  )
}
