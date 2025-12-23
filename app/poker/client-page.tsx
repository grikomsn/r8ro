"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { generateSlug } from "@/lib/utils/slug";
import { History, X, Plus, LogIn } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  getRecentPokerSessions,
  addRecentPokerSession,
  removeRecentPokerSession,
  type RecentPokerSession,
} from "@/lib/utils/recent-poker-sessions";
import { UserAccountPopover } from "@/components/auth/user-account-popover";
import {
  VOTING_SCALES,
  type VotingScaleType,
} from "@/lib/constants/poker-scales";

export default function PokerClientPage() {
  const router = useRouter();
  const {
    userId,
    displayName,
    updateDisplayName,
    isLoading: authLoading,
    isInitialized,
  } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [username, setUsername] = useState("");
  const [createForm, setCreateForm] = useState({
    title: "",
    scale: "fibonacci" as VotingScaleType,
  });
  const [joinForm, setJoinForm] = useState({ slug: "" });
  const [error, setError] = useState("");
  const [recentSessions, setRecentSessions] = useState<RecentPokerSession[]>(
    []
  );

  useEffect(() => {
    if (isInitialized && displayName) {
      setUsername(displayName);
    }
  }, [isInitialized, displayName]);

  useEffect(() => {
    setRecentSessions(getRecentPokerSessions());
  }, []);

  const handleRemoveRecent = (slug: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    removeRecentPokerSession(slug);
    setRecentSessions(getRecentPokerSessions());
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError("Please enter your name");
      return;
    }
    if (!userId) {
      setError("Authentication not ready. Please wait...");
      return;
    }

    setIsCreating(true);
    setError("");

    try {
      const supabase = createClient();
      const slug = generateSlug();

      if (username.trim() !== displayName) {
        const success = await updateDisplayName(username.trim());
        if (!success) {
          console.warn(
            "Failed to update display name, continuing with current name"
          );
        }
      }

      const votingScale = VOTING_SCALES[createForm.scale];

      const sessionData = {
        slug,
        title: createForm.title.trim() || "Untitled Poker Session",
        author_id: userId,
        author_name: username.trim(),
        voting_scale: votingScale,
        is_public: true,
        votes_revealed: false,
        is_voting_active: true,
      };

      const { error: insertError } = await supabase
        .from("poker_sessions")
        .insert(sessionData);

      if (insertError) {
        throw new Error(insertError.message || "Failed to create session");
      }

      const { data: sessionDataResult, error: sessionError } = await supabase
        .from("poker_sessions")
        .select("id")
        .eq("slug", slug)
        .single();

      if (sessionError || !sessionDataResult) {
        throw new Error(
          sessionError?.message || "Failed to fetch created session"
        );
      }

      const { error: participantError } = await supabase
        .from("poker_participants")
        .insert({
          session_id: sessionDataResult.id,
          user_id: userId,
          username: username.trim(),
          is_online: true,
          is_observer: false,
        });

      if (participantError) {
        throw new Error(
          participantError.message || "Failed to join as participant"
        );
      }

      addRecentPokerSession(
        slug,
        createForm.title.trim() || "Untitled Poker Session"
      );
      router.push(`/poker/${slug}`);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to create session. Please try again.";
      setError(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinForm.slug.trim() || !username.trim()) {
      setError("Please fill in all fields");
      return;
    }
    if (!userId) {
      setError("Authentication not ready. Please wait...");
      return;
    }

    setIsJoining(true);
    setError("");

    try {
      const supabase = createClient();
      const { data: session, error: fetchError } = await supabase
        .from("poker_sessions")
        .select("id, is_public, title")
        .eq("slug", joinForm.slug.trim().toLowerCase())
        .single();

      if (fetchError || !session) {
        setError("Session not found. Check the code and try again.");
        return;
      }

      if (username.trim() !== displayName) {
        const success = await updateDisplayName(username.trim());
        if (!success) {
          console.warn(
            "Failed to update display name, continuing with current name"
          );
        }
      }

      addRecentPokerSession(joinForm.slug.trim().toLowerCase(), session.title);
      router.push(`/poker/${joinForm.slug.trim().toLowerCase()}`);
    } catch (err) {
      console.error(err);
      setError("Failed to join session. Please try again.");
    } finally {
      setIsJoining(false);
    }
  };

  if (!isInitialized) {
    return (
      <main className="min-h-screen bg-secondary p-4 md:p-8 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-foreground/60">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "r8ro Scrum Poker",
            description:
              "Real-time collaborative planning poker tool for agile teams. Create sessions, estimate stories, and vote together.",
            url: "https://r8ro.app/poker",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
            },
            featureList: [
              "Real-time collaboration",
              "Planning poker voting",
              "Multiple voting scales",
              "Public and private session modes",
              "Vote reveal controls",
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
            {/* Recent sessions section */}
            {recentSessions.length > 0 && (
              <Card className="rounded-2xl border-2 border-border shadow-md overflow-hidden p-0 gap-0">
                <div className="border-b-2 border-border bg-muted px-6 py-4 flex items-center gap-2">
                  <History className="h-5 w-5" />
                  <h2 className="text-base font-bold uppercase">Recent</h2>
                </div>
                <CardContent className="p-4">
                  <div className="grid gap-2">
                    {recentSessions.map((session) => (
                      <a
                        key={session.slug}
                        href={`/poker/${session.slug}`}
                        className="group flex items-center justify-between rounded-xl border-2 border-border bg-background px-4 py-3 font-bold shadow-sm transition-all hover:shadow-md hover:border-primary"
                      >
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="truncate">{session.title}</span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {session.slug}
                          </span>
                        </div>
                        <button
                          onClick={(e) => handleRemoveRecent(session.slug, e)}
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
            <Card className="rounded-2xl border-2 border-border shadow-lg overflow-hidden p-0 gap-0">
              <CardContent className="p-0">
                <Tabs defaultValue="create" className="w-full">
                  <TabsList className="grid h-auto w-full grid-cols-2 border-b-2 border-border p-0 rounded-none bg-muted">
                    <TabsTrigger
                      value="create"
                      className="rounded-none border-b-4 border-transparent py-4 text-base font-bold uppercase data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:text-foreground gap-2"
                    >
                      <Plus className="h-5 w-5" />
                      Create
                    </TabsTrigger>
                    <TabsTrigger
                      value="join"
                      className="rounded-none border-b-4 border-transparent py-4 text-base font-bold uppercase data-[state=active]:border-accent data-[state=active]:bg-background data-[state=active]:text-foreground gap-2"
                    >
                      <LogIn className="h-5 w-5" />
                      Join
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="create" className="p-6 md:p-8 mt-0">
                    <form onSubmit={handleCreateSession} className="space-y-5">
                      <div className="space-y-2">
                        <Label
                          htmlFor="create-username"
                          className="text-sm font-bold uppercase"
                        >
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
                        <Label
                          htmlFor="create-title"
                          className="text-sm font-bold uppercase text-muted-foreground"
                        >
                          Session Title{" "}
                          <span className="text-xs">(Optional)</span>
                        </Label>
                        <Input
                          id="create-title"
                          placeholder="Sprint 42 Planning"
                          value={createForm.title}
                          onChange={(e) =>
                            setCreateForm({
                              ...createForm,
                              title: e.target.value,
                            })
                          }
                          className="h-12 rounded-xl border-2 border-border bg-background px-4 text-base shadow-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="create-scale"
                          className="text-sm font-bold uppercase text-muted-foreground"
                        >
                          Voting Scale
                        </Label>
                        <select
                          id="create-scale"
                          value={createForm.scale}
                          onChange={(e) =>
                            setCreateForm({
                              ...createForm,
                              scale: e.target.value as VotingScaleType,
                            })
                          }
                          className="h-12 w-full rounded-xl border-2 border-border bg-background px-4 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="fibonacci">
                            Fibonacci (1, 2, 3, 5, 8, 13, 21, ?)
                          </option>
                          <option value="tshirt">
                            T-shirt (XS, S, M, L, XL, XXL, ?)
                          </option>
                          <option value="linear">Linear (1-10)</option>
                        </select>
                      </div>
                      {error && (
                        <div className="rounded-xl border-2 border-primary/20 bg-primary/10 px-4 py-3">
                          <p className="text-sm font-bold text-primary">
                            {error}
                          </p>
                        </div>
                      )}
                      <Button
                        type="submit"
                        disabled={isCreating || authLoading || !userId}
                        className="w-full rounded-xl border-2 border-border bg-primary py-6 text-base font-bold uppercase shadow-md transition-all hover:shadow-lg hover:brightness-105"
                      >
                        {isCreating ? "Creating..." : "Start New Session"}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="join" className="p-6 md:p-8 mt-0">
                    <form onSubmit={handleJoinSession} className="space-y-5">
                      <div className="space-y-2">
                        <Label
                          htmlFor="join-username"
                          className="text-sm font-bold uppercase"
                        >
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
                        <Label
                          htmlFor="join-slug"
                          className="text-sm font-bold uppercase"
                        >
                          Session Code
                        </Label>
                        <Input
                          id="join-slug"
                          placeholder="swift-falcon-123"
                          value={joinForm.slug}
                          onChange={(e) =>
                            setJoinForm({ ...joinForm, slug: e.target.value })
                          }
                          className="h-12 rounded-xl border-2 border-border bg-background px-4 text-base font-mono shadow-sm"
                          required
                        />
                      </div>
                      {error && (
                        <div className="rounded-xl border-2 border-primary/20 bg-primary/10 px-4 py-3">
                          <p className="text-sm font-bold text-primary">
                            {error}
                          </p>
                        </div>
                      )}
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
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
