"use client";

import { History, ListChecks, LogIn, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
import { UserAccountPopover } from "@/components/auth/user-account-popover";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { FIELD_LIMITS } from "@/lib/constants/field-limits";
import {
  VOTING_SCALES,
  type VotingScaleType,
} from "@/lib/constants/poker-scales";
import { validateUsername } from "@/lib/constants/username";
import { createClient } from "@/lib/supabase/client";
import {
  addRecentPokerSession,
  getRecentPokerSessions,
  type RecentPokerSession,
  removeRecentPokerSession,
} from "@/lib/utils/recent-poker-sessions";
import { withSlugRetry } from "@/lib/utils/slug";

interface PokerSessionListItem {
  slug: string;
  title: string;
}

export default function PokerClientPage() {
  const router = useRouter();
  const {
    authError,
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
  const [mySessions, setMySessions] = useState<PokerSessionListItem[]>([]);
  const [mySessionsError, setMySessionsError] = useState("");
  const [isMySessionsLoading, setIsMySessionsLoading] = useState(false);

  useEffect(() => {
    if (isInitialized && displayName) {
      setUsername(displayName);
    }
  }, [isInitialized, displayName]);

  useEffect(() => {
    setRecentSessions(getRecentPokerSessions());
  }, []);

  // Sessions the user created, read from the database rather than the recent
  // cookie, so they stay reachable when the cookie expires or is cleared.
  useEffect(() => {
    if (!userId) {
      setMySessions([]);
      setMySessionsError("");
      setIsMySessionsLoading(false);
      return;
    }

    let isMounted = true;

    const loadMySessions = async () => {
      setIsMySessionsLoading(true);
      setMySessionsError("");

      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from("poker_sessions")
          .select("slug, title")
          .eq("author_id", userId)
          .order("updated_at", { ascending: false })
          .limit(50);

        if (fetchError) {
          throw new Error(
            fetchError.message || "Failed to load your poker sessions"
          );
        }

        if (isMounted) {
          setMySessions(data ?? []);
        }
      } catch (err) {
        console.error("Failed to load user-created poker sessions:", err);

        if (isMounted) {
          setMySessions([]);
          setMySessionsError("Could not load your created sessions right now.");
        }
      } finally {
        if (isMounted) {
          setIsMySessionsLoading(false);
        }
      }
    };

    loadMySessions();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const handleRemoveRecent = (slug: string) => {
    removeRecentPokerSession(slug);
    setRecentSessions(getRecentPokerSessions());
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();

    const usernameError = validateUsername(username);
    if (usernameError) {
      setError(usernameError);
      return;
    }

    if (!userId) {
      setError(ERROR_MESSAGES.AUTH_NOT_READY);
      return;
    }

    setIsCreating(true);
    setError("");

    try {
      const supabase = createClient();

      if (username.trim() !== displayName) {
        const success = await updateDisplayName(username.trim());
        if (!success) {
          console.warn(
            "Failed to update display name, continuing with current name"
          );
        }
      }

      const votingScale = VOTING_SCALES[createForm.scale];

      // The slug space is finite, so a collision is retried with a new slug
      // rather than reported as a raw database error.
      const { data: inserted, error: insertError } = await withSlugRetry(
        async (slug) => {
          const { data, error } = await supabase
            .from("poker_sessions")
            .insert({
              slug,
              title: createForm.title.trim() || "Untitled Poker Session",
              author_id: userId,
              author_name: username.trim(),
              voting_scale: votingScale,
              is_public: true,
              votes_revealed: false,
              is_voting_active: true,
            })
            .select("id, slug")
            .single();

          return { data, error };
        }
      );

      if (insertError || !inserted) {
        throw new Error(insertError?.message || ERROR_MESSAGES.CREATE_FAILED);
      }

      const slug = inserted.slug;

      const { error: participantError } = await supabase
        .from("poker_participants")
        .insert({
          session_id: inserted.id,
          user_id: userId,
          username: username.trim(),
          is_online: true,
          is_observer: false,
        });

      if (participantError) {
        throw new Error(participantError.message || ERROR_MESSAGES.JOIN_FAILED);
      }

      addRecentPokerSession(
        slug,
        createForm.title.trim() || "Untitled Poker Session"
      );
      router.push(`/poker/${slug}`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : ERROR_MESSAGES.CREATE_FAILED;
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
      setError(ERROR_MESSAGES.AUTH_NOT_READY);
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
        setError(ERROR_MESSAGES.SESSION_NOT_FOUND);
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
      setError(ERROR_MESSAGES.JOIN_FAILED);
    } finally {
      setIsJoining(false);
    }
  };

  if (!isInitialized) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-secondary p-4 md:p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="font-medium text-foreground/60 text-sm">Loading…</p>
        </div>
      </main>
    );
  }

  if (authError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-secondary p-4 md:p-8">
        <div
          className="max-w-md rounded-2xl border-2 border-border bg-background p-8 shadow-md"
          role="alert"
        >
          <p className="font-bold text-primary text-xl">Session unavailable</p>
          <p className="mt-2 text-muted-foreground text-sm">{authError}</p>
          <button
            className="mt-6 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground text-sm"
            onClick={() => window.location.reload()}
            type="button"
          >
            Retry
          </button>
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
              "Realtime planning poker with configurable scales and vote reveal.",
            url: "https://r8ro.app/poker",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            featureList: [
              "Realtime votes and presence",
              "Fibonacci, T-shirt, and linear scales",
              "Vote reveal",
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
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {userId && <UserAccountPopover />}
            </div>
          </div>
        </header>

        {/* Main content area */}
        <div className="flex flex-1 flex-col items-center justify-center p-4 md:p-8">
          <div className="w-full max-w-2xl space-y-6">
            {/* Sessions the user created, read from the database */}
            {(mySessions.length > 0 ||
              isMySessionsLoading ||
              mySessionsError) && (
              <Card className="gap-0 overflow-hidden rounded-2xl border-2 border-border p-0 shadow-md">
                <div className="flex items-center gap-2 border-border border-b-2 bg-muted px-6 py-4">
                  <ListChecks className="h-5 w-5" />
                  <h2 className="font-bold text-base uppercase">My Sessions</h2>
                </div>
                <CardContent className="p-4">
                  {isMySessionsLoading ? (
                    <p className="text-muted-foreground text-sm">
                      Loading your sessions…
                    </p>
                  ) : mySessionsError ? (
                    <p className="text-destructive text-sm">
                      {mySessionsError}
                    </p>
                  ) : (
                    <div className="grid gap-2">
                      {mySessions.map((session) => (
                        <Link
                          className="flex min-w-0 flex-col gap-1 rounded-xl border-2 border-border bg-background px-4 py-3 font-bold shadow-sm transition-[border-color,box-shadow] hover:border-primary hover:shadow-md"
                          href={`/poker/${session.slug}`}
                          key={session.slug}
                        >
                          <span className="truncate">{session.title}</span>
                          <span className="font-mono text-muted-foreground text-xs">
                            {session.slug}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

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
                      <div
                        className="group flex items-center justify-between rounded-xl border-2 border-border bg-background px-4 py-3 font-bold shadow-sm transition-[border-color,box-shadow] hover:border-primary hover:shadow-md"
                        key={session.slug}
                      >
                        <Link
                          className="flex min-w-0 flex-1 flex-col gap-1"
                          href={`/poker/${session.slug}`}
                        >
                          <span className="truncate">{session.title}</span>
                          <span className="font-mono text-muted-foreground text-xs">
                            {session.slug}
                          </span>
                        </Link>
                        <button
                          aria-label="Remove from recent"
                          className="ml-2 shrink-0 opacity-100 transition-opacity focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                          onClick={() => handleRemoveRecent(session.slug)}
                          type="button"
                        >
                          <X className="h-4 w-4 text-muted-foreground hover:text-primary" />
                        </button>
                      </div>
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
                          autoComplete="name"
                          className="h-12 rounded-xl border-2 border-border bg-background px-4 text-base shadow-sm"
                          id="create-username"
                          name="username"
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
                          autoComplete="off"
                          className="h-12 rounded-xl border-2 border-border bg-background px-4 text-base shadow-sm"
                          id="create-title"
                          maxLength={FIELD_LIMITS.sessionTitle}
                          name="sessionTitle"
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
                          className="h-12 w-full rounded-xl border-2 border-border bg-background px-4 text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          id="create-scale"
                          name="votingScale"
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
                          <p
                            aria-live="polite"
                            className="font-bold text-primary text-sm"
                          >
                            {error}
                          </p>
                        </div>
                      )}
                      <Button
                        className="w-full rounded-xl border-2 border-border bg-primary py-6 font-bold text-base uppercase shadow-md transition-[box-shadow,filter] hover:shadow-lg hover:brightness-105"
                        disabled={isCreating || authLoading || !userId}
                        type="submit"
                      >
                        {isCreating ? "Creating…" : "Start New Session"}
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
                          autoComplete="name"
                          className="h-12 rounded-xl border-2 border-border bg-background px-4 text-base shadow-sm"
                          id="join-username"
                          name="username"
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
                          autoComplete="off"
                          className="h-12 rounded-xl border-2 border-border bg-background px-4 font-mono text-base shadow-sm"
                          id="join-slug"
                          name="sessionCode"
                          onChange={(e) =>
                            setJoinForm({ ...joinForm, slug: e.target.value })
                          }
                          placeholder="swift-falcon-123"
                          required
                          spellCheck={false}
                          value={joinForm.slug}
                        />
                      </div>
                      {error && (
                        <div className="rounded-xl border-2 border-primary/20 bg-primary/10 px-4 py-3">
                          <p
                            aria-live="polite"
                            className="font-bold text-primary text-sm"
                          >
                            {error}
                          </p>
                        </div>
                      )}
                      <Button
                        className="w-full rounded-xl border-2 border-border bg-accent py-6 font-bold text-accent-foreground text-base uppercase shadow-md transition-[box-shadow,filter] hover:shadow-lg hover:brightness-105"
                        disabled={isJoining || authLoading || !userId}
                        type="submit"
                      >
                        {isJoining ? "Joining…" : "Join Session"}
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
