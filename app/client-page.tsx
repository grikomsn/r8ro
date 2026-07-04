"use client";

import { History, LogIn, Plus, UserRound, X } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import {
  addRecentBoard,
  getRecentBoards,
  type RecentBoard,
  removeRecentBoard,
} from "@/lib/utils/recent-boards";
import { generateSlug } from "@/lib/utils/slug";

const USERNAME_MAX_LENGTH = 30;
const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;

type RetroBoardListItem = Pick<RecentBoard, "slug" | "title">;

interface RetroBoardListProps {
  boards: RetroBoardListItem[];
  emptyMessage: string;
  onRemove?: (slug: string) => void;
}

function RetroBoardList({
  boards,
  emptyMessage,
  onRemove,
}: RetroBoardListProps) {
  if (boards.length === 0) {
    return (
      <p className="px-2 py-3 text-muted-foreground text-sm">{emptyMessage}</p>
    );
  }

  return (
    <div className="grid gap-2">
      {boards.map((board) => (
        <div
          className="group flex items-center justify-between rounded-xl border-2 border-border bg-background px-4 py-3 font-bold shadow-sm transition-[border-color,box-shadow] hover:border-primary hover:shadow-md"
          key={board.slug}
        >
          <Link
            className="flex min-w-0 flex-1 flex-col gap-1"
            href={`/retro/${board.slug}`}
          >
            <span className="truncate">{board.title}</span>
            <span className="font-mono text-muted-foreground text-xs">
              {board.slug}
            </span>
          </Link>
          {onRemove ? (
            <button
              aria-label="Remove from recent"
              className="ml-2 shrink-0 opacity-100 transition-opacity focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
              onClick={() => onRemove(board.slug)}
              type="button"
            >
              <X className="h-4 w-4 text-muted-foreground hover:text-primary" />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function RetroClientPage() {
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
  const [createForm, setCreateForm] = useState({ title: "" });
  const [joinForm, setJoinForm] = useState({ slug: "" });
  const [error, setError] = useState("");
  const [recentBoards, setRecentBoards] = useState<RecentBoard[]>([]);
  const [myBoards, setMyBoards] = useState<RetroBoardListItem[]>([]);
  const [isMyBoardsLoading, setIsMyBoardsLoading] = useState(false);
  const [myBoardsError, setMyBoardsError] = useState("");

  useEffect(() => {
    if (isInitialized && displayName) {
      setUsername(displayName);
    }
  }, [isInitialized, displayName]);

  useEffect(() => {
    setRecentBoards(getRecentBoards());
  }, []);

  useEffect(() => {
    if (!userId) {
      setMyBoards([]);
      setMyBoardsError("");
      setIsMyBoardsLoading(false);
      return;
    }

    let isMounted = true;

    const loadMyBoards = async () => {
      setIsMyBoardsLoading(true);
      setMyBoardsError("");

      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from("retro_boards")
          .select("slug, title")
          .eq("author_id", userId)
          .order("updated_at", { ascending: false })
          .limit(10);

        if (fetchError) {
          throw new Error(fetchError.message || "Failed to load your retros");
        }

        if (isMounted) {
          setMyBoards(data ?? []);
        }
      } catch (err) {
        console.error("Failed to load user-created retros:", err);

        if (isMounted) {
          setMyBoards([]);
          setMyBoardsError("Could not load your created retros right now.");
        }
      } finally {
        if (isMounted) {
          setIsMyBoardsLoading(false);
        }
      }
    };

    loadMyBoards();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const handleRemoveRecent = (slug: string) => {
    removeRecentBoard(slug);
    setRecentBoards(getRecentBoards());
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError(ERROR_MESSAGES.USERNAME_REQUIRED);
      return;
    }
    if (username.length > USERNAME_MAX_LENGTH) {
      setError(`Name must be ${USERNAME_MAX_LENGTH} characters or less`);
      return;
    }
    if (!USERNAME_REGEX.test(username)) {
      setError(
        "Name can only contain letters, numbers, underscores, and hyphens"
      );
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
      const slug = generateSlug();

      if (username.trim() !== displayName) {
        const success = await updateDisplayName(username.trim());
        if (!success) {
          console.warn(
            "Failed to update display name, continuing with current name"
          );
        }
      }

      const boardData = {
        slug,
        title: createForm.title.trim() || "Untitled Retro",
        author_id: userId,
        author_name: username.trim(),
        is_public: true,
        timer_running: false,
        timer_seconds: 0,
      };

      const { error: insertError } = await supabase
        .from("retro_boards")
        .insert(boardData);

      if (insertError) {
        throw new Error(insertError.message || ERROR_MESSAGES.CREATE_FAILED);
      }

      const { data: boardDataResult, error: boardError } = await supabase
        .from("retro_boards")
        .select("id")
        .eq("slug", slug)
        .single();

      if (boardError || !boardDataResult) {
        throw new Error(boardError?.message || ERROR_MESSAGES.CREATE_FAILED);
      }

      const { error: participantError } = await supabase
        .from("retro_participants")
        .insert({
          board_id: boardDataResult.id,
          user_id: userId,
          username: username.trim(),
          is_online: true,
        });

      if (participantError) {
        throw new Error(participantError.message || ERROR_MESSAGES.JOIN_FAILED);
      }

      addRecentBoard(slug, createForm.title.trim() || "Untitled Retro");
      router.push(`/retro/${slug}`);
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
      const { data: board, error: fetchError } = await supabase
        .from("retro_boards")
        .select("id, is_public, title")
        .eq("slug", joinForm.slug.trim().toLowerCase())
        .single();

      if (fetchError || !board) {
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

      addRecentBoard(joinForm.slug.trim().toLowerCase(), board.title);
      router.push(`/retro/${joinForm.slug.trim().toLowerCase()}`);
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

  const shouldShowRetrosSection =
    !!userId ||
    recentBoards.length > 0 ||
    myBoards.length > 0 ||
    isMyBoardsLoading ||
    !!myBoardsError;

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "r8ro",
            description:
              "Realtime retrospective boards with cards, voting, presence, and a shared timer.",
            url: "https://r8ro.app",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            featureList: [
              "Realtime cards and votes",
              "Participant presence",
              "Shared timer",
              "Public, private, and locked boards",
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
            {/* Recent boards section */}
            {shouldShowRetrosSection && (
              <Card className="gap-0 overflow-hidden rounded-2xl border-2 border-border p-0 shadow-md">
                <CardContent className="p-0">
                  <Tabs
                    className="w-full"
                    defaultValue={userId ? "mine" : "recent"}
                  >
                    <TabsList className="grid h-auto w-full grid-cols-2 rounded-none border-border border-b-2 bg-muted p-0">
                      <TabsTrigger
                        className="gap-2 rounded-none border-transparent border-b-4 py-4 font-bold text-base uppercase data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:text-foreground"
                        value="mine"
                      >
                        <UserRound className="h-5 w-5" />
                        My Retros
                      </TabsTrigger>
                      <TabsTrigger
                        className="gap-2 rounded-none border-transparent border-b-4 py-4 font-bold text-base uppercase data-[state=active]:border-accent data-[state=active]:bg-background data-[state=active]:text-foreground"
                        value="recent"
                      >
                        <History className="h-5 w-5" />
                        Recent
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent className="mt-0 p-4" value="mine">
                      {isMyBoardsLoading ? (
                        <p className="px-2 py-3 text-muted-foreground text-sm">
                          Loading your retros…
                        </p>
                      ) : myBoardsError ? (
                        <div className="rounded-xl border-2 border-primary/20 bg-primary/10 px-4 py-3">
                          <p
                            aria-live="polite"
                            className="font-bold text-primary text-sm"
                          >
                            {myBoardsError}
                          </p>
                        </div>
                      ) : (
                        <RetroBoardList
                          boards={myBoards}
                          emptyMessage="No created retros yet. Start one from the Create tab below."
                        />
                      )}
                    </TabsContent>

                    <TabsContent className="mt-0 p-4" value="recent">
                      <RetroBoardList
                        boards={recentBoards}
                        emptyMessage="No recent retros yet. Join or create a session to see it here."
                        onRemove={handleRemoveRecent}
                      />
                    </TabsContent>
                  </Tabs>
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
                          name="sessionTitle"
                          onChange={(e) =>
                            setCreateForm({
                              ...createForm,
                              title: e.target.value,
                            })
                          }
                          placeholder="Sprint 42 Retro"
                          value={createForm.title}
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
                        className="w-full rounded-xl border-2 border-border bg-primary py-6 font-bold text-base uppercase shadow-md transition-[box-shadow,filter] hover:shadow-lg hover:brightness-105"
                        disabled={isCreating || authLoading || !userId}
                        type="submit"
                      >
                        {isCreating ? "Creating…" : "Start New Retro"}
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
