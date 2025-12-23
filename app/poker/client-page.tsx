"use client";

import { History, LogIn, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
import { UserAccountPopover } from "@/components/auth/user-account-popover";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import {
  VOTING_SCALES,
  type VotingScaleType,
} from "@/lib/constants/poker-scales";
import { createClient } from "@/lib/supabase/client";
import {
  addRecentPokerSession,
  getRecentPokerSessions,
  type RecentPokerSession,
  removeRecentPokerSession,
} from "@/lib/utils/recent-poker-sessions";
import { generateSlug } from "@/lib/utils/slug";

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
    if (!(joinForm.slug.trim() && username.trim())) {
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
      <main className="flex min-h-screen flex-col items-center justify-center bg-secondary p-4 md:p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="font-medium text-foreground/60 text-sm">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <>
      <script
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
        type="application/ld+json"
      />
      <main className="flex min-h-screen flex-col bg-secondary">
        {/* Header with branding and account */}
        <header className="border-border border-b-2 bg-background">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <h1 className="font-black font-mono text-2xl uppercase tracking-tight">
              r<span className="text-primary">8</span>ro
            </h1>
            {userId && <UserAccountPopover />}
          </div>
        </header>

        {/* Main content area */}
        <div className="flex flex-1 flex-col items-center justify-center p-4 md:p-8">
          <div className="w-full max-w-2xl space-y-6">
            {/* Recent sessions section */}
            {recentSessions.length > 0 && (
              <Card className="gap-0 overflow-hidden rounded-2xl border-2 border-border p-0 shadow-md">
                <div className="flex items-center gap-2 border-border border-b-2 bg-muted px-6 py-4">
                  <History className="h-5 w-5" />
                  <h2 className="font-bold text-base uppercase">Recent</h2>
                </div>
                <CardContent className="p-4">
                  <div className="grid gap-2">
                    {recentSessions.map((session) => (
                      <a
                        className="group flex items-center justify-between rounded-xl border-2 border-border bg-background px-4 py-3 font-bold shadow-sm transition-all hover:border-primary hover:shadow-md"
                        href={`/poker/${session.slug}`}
                        key={session.slug}
                      >
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className="truncate">{session.title}</span>
                          <span className="font-mono text-muted-foreground text-xs">
                            {session.slug}
                          </span>
                        </div>
                        <button
                          aria-label="Remove from recent"
                          className="ml-2 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={(e) => handleRemoveRecent(session.slug, e)}
                          type="button"
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
            <Card className="gap-0 overflow-hidden rounded-2xl border-2 border-border p-0 shadow-lg">
              <CardContent className="p-0">
                <Tabs className="w-full" defaultValue="create">
                  <TabsList className="grid h-auto w-full grid-cols-2 rounded-none border-border border-b-2 bg-muted p-0">
                    <TabsTrigger
                      className="gap-2 rounded-none border-transparent border-b-4 py-4 font-bold text-base uppercase data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:text-foreground"
                      value="create"
                    >
                      <Plus className="h-5 w-5" />
                      Create
                    </TabsTrigger>
                    <TabsTrigger
                      className="gap-2 rounded-none border-transparent border-b-4 py-4 font-bold text-base uppercase data-[state=active]:border-accent data-[state=active]:bg-background data-[state=active]:text-foreground"
                      value="join"
                    >
                      <LogIn className="h-5 w-5" />
                      Join
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent className="mt-0 p-6 md:p-8" value="create">
                    <form className="space-y-5" onSubmit={handleCreateSession}>
                      <div className="space-y-2">
                        <Label
                          className="font-bold text-sm uppercase"
                          htmlFor="create-username"
                        >
                          Your Name
                        </Label>
                        <Input
                          className="h-12 rounded-xl border-2 border-border bg-background px-4 text-base shadow-sm"
                          id="create-username"
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="Enter your name"
                          required
                          value={username}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label
                          className="font-bold text-muted-foreground text-sm uppercase"
                          htmlFor="create-title"
                        >
                          Session Title{" "}
                          <span className="text-xs">(Optional)</span>
                        </Label>
                        <Input
                          className="h-12 rounded-xl border-2 border-border bg-background px-4 text-base shadow-sm"
                          id="create-title"
                          onChange={(e) =>
                            setCreateForm({
                              ...createForm,
                              title: e.target.value,
                            })
                          }
                          placeholder="Sprint 42 Planning"
                          value={createForm.title}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label
                          className="font-bold text-muted-foreground text-sm uppercase"
                          htmlFor="create-scale"
                        >
                          Voting Scale
                        </Label>
                        <select
                          className="h-12 w-full rounded-xl border-2 border-border bg-background px-4 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          id="create-scale"
                          onChange={(e) =>
                            setCreateForm({
                              ...createForm,
                              scale: e.target.value as VotingScaleType,
                            })
                          }
                          value={createForm.scale}
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
                          <p className="font-bold text-primary text-sm">
                            {error}
                          </p>
                        </div>
                      )}
                      <Button
                        className="w-full rounded-xl border-2 border-border bg-primary py-6 font-bold text-base uppercase shadow-md transition-all hover:shadow-lg hover:brightness-105"
                        disabled={isCreating || authLoading || !userId}
                        type="submit"
                      >
                        {isCreating ? "Creating..." : "Start New Session"}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent className="mt-0 p-6 md:p-8" value="join">
                    <form className="space-y-5" onSubmit={handleJoinSession}>
                      <div className="space-y-2">
                        <Label
                          className="font-bold text-sm uppercase"
                          htmlFor="join-username"
                        >
                          Your Name
                        </Label>
                        <Input
                          className="h-12 rounded-xl border-2 border-border bg-background px-4 text-base shadow-sm"
                          id="join-username"
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="Enter your name"
                          required
                          value={username}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label
                          className="font-bold text-sm uppercase"
                          htmlFor="join-slug"
                        >
                          Session Code
                        </Label>
                        <Input
                          className="h-12 rounded-xl border-2 border-border bg-background px-4 font-mono text-base shadow-sm"
                          id="join-slug"
                          onChange={(e) =>
                            setJoinForm({ ...joinForm, slug: e.target.value })
                          }
                          placeholder="swift-falcon-123"
                          required
                          value={joinForm.slug}
                        />
                      </div>
                      {error && (
                        <div className="rounded-xl border-2 border-primary/20 bg-primary/10 px-4 py-3">
                          <p className="font-bold text-primary text-sm">
                            {error}
                          </p>
                        </div>
                      )}
                      <Button
                        className="w-full rounded-xl border-2 border-border bg-accent py-6 font-bold text-accent-foreground text-base uppercase shadow-md transition-all hover:shadow-lg hover:brightness-105"
                        disabled={isJoining || authLoading || !userId}
                        type="submit"
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
