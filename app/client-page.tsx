"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createClient } from "@/lib/supabase/client"
import { generateSlug } from "@/lib/utils/slug"
import { Zap, Users, Clock, Shield, History, X } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { getRecentBoards, addRecentBoard, removeRecentBoard, type RecentBoard } from "@/lib/utils/recent-boards"
import { UserAccountPopover } from "@/components/auth/user-account-popover"
import { ValidationError, getErrorMessage } from "@/lib/utils/errors"

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
      setError("Please enter your display name")
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

      const { data: createdBoard, error: insertError } = await supabase
        .from("retro_boards")
        .insert(boardData)
        .select("id, slug, title")
        .single()

      if (insertError) {
        throw new ValidationError("Failed to create board", { error: insertError })
      }

      if (!createdBoard) {
        throw new ValidationError("Board creation returned no data")
      }

      const { error: participantError } = await supabase.from("retro_participants").insert({
        board_id: createdBoard.id,
        user_id: userId,
        username: username.trim(),
        is_online: true,
      })

      if (participantError) {
        console.error("Failed to join as participant:", participantError)
      }

      addRecentBoard(slug, createdBoard.title)
      router.push(`/retro/${slug}`)
    } catch (err) {
      const errorMessage = getErrorMessage(err)
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
        .select("id, is_public, title, slug")
        .eq("slug", joinForm.slug.trim().toLowerCase())
        .single()

      if (fetchError) {
        if (fetchError.code === "PGRST116") {
          throw new ValidationError("Session not found. Check the URL and try again.")
        }
        throw new ValidationError("Failed to find session", { error: fetchError })
      }

      if (!board) {
        throw new ValidationError("Session not found. Check the URL and try again.")
      }

      if (username.trim() !== displayName) {
        await updateDisplayName(username.trim())
      }

      addRecentBoard(board.slug, board.title)
      router.push(`/retro/${joinForm.slug.trim().toLowerCase()}`)
    } catch (err) {
      const errorMessage = getErrorMessage(err)
      setError(errorMessage)
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
      <main className="min-h-screen bg-secondary p-4 md:p-8 flex flex-col items-center justify-center">
        <div className="w-full max-w-4xl">
          {userId && (
            <div className="mb-6 flex justify-end">
              <UserAccountPopover />
            </div>
          )}

          <div className="mb-12 text-center">
            <h1 className="mb-4 text-5xl font-black uppercase tracking-tight md:text-6xl font-mono">
              r<span className="text-primary">8</span>ro
            </h1>
            <p className="mx-auto max-w-2xl text-base font-medium text-foreground/80 md:text-lg">
              Real-time collaborative retrospectives for agile teams. Brainstorm, vote, and improve together.
            </p>
          </div>

          <div className="mb-12 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { icon: Zap, label: "Real-time Sync" },
              { icon: Users, label: "Collaborate" },
              { icon: Clock, label: "Timer Control" },
              { icon: Shield, label: "Privacy Toggle" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-3 rounded-xl border-2 border-border bg-background p-6 shadow-sm"
              >
                <Icon className="h-8 w-8" />
                <span className="text-center text-sm font-bold uppercase">{label}</span>
              </div>
            ))}
          </div>

          {recentBoards.length > 0 && (
            <Card className="mb-8 rounded-2xl border-2 border-border shadow-md overflow-hidden p-0 gap-0">
              <CardHeader className="border-b-2 border-border bg-muted px-6 py-4">
                <CardTitle className="flex items-center gap-2 text-lg font-bold uppercase">
                  <History className="h-5 w-5" />
                  Recent Boards
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex flex-wrap gap-3">
                  {recentBoards.map((board) => (
                    <a
                      key={board.slug}
                      href={`/retro/${board.slug}`}
                      className="group flex items-center gap-2 rounded-lg border-2 border-border bg-background px-4 py-3 font-bold shadow-sm transition-all hover:shadow-md hover:border-primary"
                    >
                      <span className="truncate max-w-[150px]">{board.title}</span>
                      <span className="text-xs text-muted-foreground">({board.slug})</span>
                      <button
                        onClick={(e) => handleRemoveRecent(board.slug, e)}
                        className="ml-1 opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="h-4 w-4 text-muted-foreground hover:text-primary" />
                      </button>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-2xl border-2 border-border shadow-lg overflow-hidden p-0 gap-0">
            <CardHeader className="border-b-2 border-border bg-primary px-6 py-5 text-primary-foreground">
              <CardTitle className="text-2xl font-bold uppercase">Get Started</CardTitle>
              <CardDescription className="text-base text-primary-foreground/80">
                Create a new retro or join an existing session
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs defaultValue="create" className="w-full">
                <TabsList className="grid h-auto w-full grid-cols-2 border-b-2 border-border p-0 rounded-none">
                  <TabsTrigger
                    value="create"
                    className="rounded-none border-b-2 border-transparent py-5 text-base font-bold uppercase data-[state=active]:border-accent data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
                  >
                    Create Session
                  </TabsTrigger>
                  <TabsTrigger
                    value="join"
                    className="rounded-none border-b-2 border-transparent py-5 text-base font-bold uppercase data-[state=active]:border-accent data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
                  >
                    Join Session
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="create" className="p-8 md:p-10">
                  <form onSubmit={handleCreateSession} className="space-y-6">
                    <div className="space-y-3">
                      <Label htmlFor="create-username" className="text-sm font-bold uppercase">
                        Display Name *
                      </Label>
                      <Input
                        id="create-username"
                        placeholder="Enter your display name"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="h-12 rounded-xl border-2 border-border bg-background px-4 text-base shadow-sm"
                        required
                      />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="create-title" className="text-sm font-bold uppercase">
                        Session Title (optional)
                      </Label>
                      <Input
                        id="create-title"
                        placeholder="Sprint 42 Retro"
                        value={createForm.title}
                        onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                        className="h-12 rounded-xl border-2 border-border bg-background px-4 text-base shadow-sm"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={isCreating || authLoading || !userId}
                      className="w-full rounded-xl border-2 border-border bg-primary py-6 text-base font-bold uppercase shadow-md transition-all hover:shadow-lg hover:brightness-105"
                    >
                      {isCreating ? "Creating..." : "Create New Retro"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="join" className="p-8 md:p-10">
                  <form onSubmit={handleJoinSession} className="space-y-6">
                    <div className="space-y-3">
                      <Label htmlFor="join-username" className="text-sm font-bold uppercase">
                        Display Name *
                      </Label>
                      <Input
                        id="join-username"
                        placeholder="Enter your display name"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="h-12 rounded-xl border-2 border-border bg-background px-4 text-base shadow-sm"
                        required
                      />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="join-slug" className="text-sm font-bold uppercase">
                        Session URL or Slug *
                      </Label>
                      <Input
                        id="join-slug"
                        placeholder="swift-falcon-123"
                        value={joinForm.slug}
                        onChange={(e) => setJoinForm({ ...joinForm, slug: e.target.value })}
                        className="h-12 rounded-xl border-2 border-border bg-background px-4 text-base shadow-sm"
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={isJoining || authLoading || !userId}
                      className="w-full rounded-xl border-2 border-border bg-accent py-6 text-base font-bold uppercase text-accent-foreground shadow-md transition-all hover:shadow-lg hover:brightness-105"
                    >
                      {isJoining ? "Joining..." : "Join Session"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              {error && (
                <div className="border-t-2 border-border bg-primary/20 p-6">
                  <p className="text-sm font-bold text-primary">{error}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
