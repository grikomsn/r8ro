"use client";

import {
  ArrowRight,
  Building2,
  History,
  LogIn,
  type LucideIcon,
  Plus,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
import { AuthErrorNotice } from "@/components/shared/auth-error-notice";
import { SiteHeader } from "@/components/shared/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { FIELD_LIMITS } from "@/lib/constants/field-limits";
import {
  USERNAME_MAX_LENGTH,
  validateUsername,
} from "@/lib/constants/username";
import { listMyOrganizations } from "@/lib/organizations";
import { createClient } from "@/lib/supabase/client";
import type { OrganizationSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils/relative-time";
import { parseSessionCode } from "@/lib/utils/session-code";

export interface SessionListItem {
  slug: string;
  timestamp?: string;
  title: string;
}

interface Feature {
  description: string;
  icon: LucideIcon;
  title: string;
}

export interface SessionLandingProps {
  /** Extra create-form fields, such as the poker voting scale. */
  createExtras?: React.ReactNode;
  createLabel: string;
  /** Creates the session and returns its slug. */
  createSession: (input: {
    /** Organization that will own the session, or null for a personal one. */
    orgId: string | null;
    title: string;
    userId: string;
    username: string;
  }) => Promise<string>;
  description: string;
  eyebrow: string;
  features: Feature[];
  heading: string;
  /** Singular noun, for example "retro" or "session". */
  noun: string;
  /** Route prefix of a session, for example "/retro". */
  pathPrefix: string;
  recent: {
    add: (slug: string, title: string) => void;
    get: () => { slug: string; title: string; visitedAt?: string }[];
    remove: (slug: string) => void;
  };
  /** Table looked up by slug when joining, and listed under "Yours". */
  table: "retro_boards" | "poker_sessions";
  titlePlaceholder: string;
}

const PERSONAL_OWNER = "personal";

function relativeTime(timestamp?: string) {
  if (!timestamp) {
    return null;
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return formatRelativeTime(date);
}

function SessionList({
  emptyMessage,
  items,
  onRemove,
  pathPrefix,
  timestampLabel,
}: {
  emptyMessage: string;
  items: SessionListItem[];
  onRemove?: (slug: string) => void;
  pathPrefix: string;
  timestampLabel: string;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border-2 border-border border-dashed px-4 py-6 text-center text-muted-foreground text-sm">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="grid gap-2">
      {items.map((item) => {
        const time = relativeTime(item.timestamp);
        return (
          <li
            className="group flex items-center gap-2 rounded-xl border-2 border-border bg-background pr-2 shadow-sm transition-[border-color,box-shadow] focus-within:border-primary hover:border-primary hover:shadow-md"
            key={item.slug}
          >
            <Link
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-4 py-3 outline-none"
              href={`${pathPrefix}/${item.slug}`}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-bold">{item.title}</span>
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-muted-foreground text-xs">
                  <span className="truncate font-mono">{item.slug}</span>
                  {time && (
                    <span>
                      {timestampLabel} {time}
                    </span>
                  )}
                </span>
              </span>
              <ArrowRight
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              />
            </Link>
            {onRemove && (
              <Button
                aria-label={`Remove ${item.title} from recent`}
                className="h-8 w-8 shrink-0 rounded-lg p-0 text-muted-foreground md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                onClick={() => onRemove(item.slug)}
                variant="ghost"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const tabTriggerClass =
  "gap-2 rounded-none border-transparent border-b-4 py-3.5 font-bold text-sm data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:text-foreground md:text-base";

export function SessionLanding({
  createExtras,
  createLabel,
  createSession,
  description,
  eyebrow,
  features,
  heading,
  noun,
  pathPrefix,
  recent,
  table,
  titlePlaceholder,
}: SessionLandingProps) {
  const router = useRouter();
  const {
    authError,
    userId,
    displayName,
    isGitHubLinked,
    updateDisplayName,
    isLoading: authLoading,
    isInitialized,
  } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [ownerOrgId, setOwnerOrgId] = useState<string>(PERSONAL_OWNER);
  const [username, setUsername] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentItems, setRecentItems] = useState<SessionListItem[]>([]);
  const [mine, setMine] = useState<SessionListItem[]>([]);
  const [mineState, setMineState] = useState<"idle" | "loading" | "error">(
    "idle"
  );

  useEffect(() => {
    if (isInitialized && displayName) {
      setUsername((current) => current || displayName);
    }
  }, [isInitialized, displayName]);

  useEffect(() => {
    setRecentItems(
      recent.get().map((item) => ({
        slug: item.slug,
        title: item.title,
        timestamp: item.visitedAt,
      }))
    );
  }, [recent]);

  // Only GitHub-linked accounts can be in an organization.
  // `?org=<slug>` preselects an organization, for links from its page. It is
  // read in an effect so that the page needs no Suspense boundary.
  useEffect(() => {
    if (!(userId && isGitHubLinked)) {
      setOrganizations([]);
      setOwnerOrgId(PERSONAL_OWNER);
      return;
    }

    let isMounted = true;
    listMyOrganizations()
      .then((rows) => {
        if (!isMounted) {
          return;
        }
        setOrganizations(rows);
        const requested = new URLSearchParams(window.location.search).get(
          "org"
        );
        const match = rows.find((org) => org.slug === requested);
        if (match) {
          setOwnerOrgId(match.id);
        }
      })
      .catch((orgError) => {
        console.error("Failed to load organizations:", orgError);
      });

    return () => {
      isMounted = false;
    };
  }, [userId, isGitHubLinked]);

  // Sessions the user created are read from the database rather than the
  // recent-visits cookie, so they stay reachable after the cookie expires.
  useEffect(() => {
    if (!userId) {
      setMine([]);
      return;
    }

    let isMounted = true;
    setMineState("loading");

    createClient()
      .from(table)
      .select("slug, title, updated_at")
      .eq("author_id", userId)
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(20)
      .then(({ data, error: fetchError }) => {
        if (!isMounted) {
          return;
        }
        if (fetchError) {
          console.error(`Failed to load created ${noun}s:`, fetchError);
          setMineState("error");
          return;
        }
        setMine(
          (data ?? []).map((row) => ({
            slug: row.slug,
            title: row.title,
            timestamp: row.updated_at,
          }))
        );
        setMineState("idle");
      });

    return () => {
      isMounted = false;
    };
  }, [userId, table, noun]);

  const handleRemoveRecent = (slug: string) => {
    recent.remove(slug);
    setRecentItems((items) => items.filter((item) => item.slug !== slug));
  };

  // Validates the name and saves it to the profile before either action.
  const prepareName = async () => {
    const usernameError = validateUsername(username);
    if (usernameError) {
      setError(usernameError);
      return null;
    }
    if (!userId) {
      setError(ERROR_MESSAGES.AUTH_NOT_READY);
      return null;
    }

    const trimmed = username.trim();
    if (trimmed !== displayName) {
      const saved = await updateDisplayName(trimmed);
      if (!saved) {
        console.warn("Failed to update display name, continuing");
      }
    }
    return { trimmed, userId };
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const prepared = await prepareName();
      if (!prepared) {
        return;
      }
      const finalTitle = title.trim();
      const slug = await createSession({
        orgId: ownerOrgId === PERSONAL_OWNER ? null : ownerOrgId,
        title: finalTitle,
        userId: prepared.userId,
        username: prepared.trimmed,
      });
      router.push(`${pathPrefix}/${slug}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : ERROR_MESSAGES.CREATE_FAILED
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const slug = parseSessionCode(code);
    if (!slug) {
      setError("Enter a session code like swift-falcon-1234, or paste a link.");
      return;
    }

    setIsSubmitting(true);
    try {
      const prepared = await prepareName();
      if (!prepared) {
        return;
      }

      const { data, error: fetchError } = await createClient()
        .from(table)
        .select("title")
        .eq("slug", slug)
        .maybeSingle();

      if (fetchError) {
        throw new Error(fetchError.message);
      }
      if (!data) {
        setError(
          `No ${noun} found for “${slug}”. Check the code, or ask the host whether it is private.`
        );
        return;
      }

      recent.add(slug, data.title);
      router.push(`${pathPrefix}/${slug}`);
    } catch (err) {
      console.error(err);
      setError(ERROR_MESSAGES.JOIN_FAILED);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authError) {
    return <AuthErrorNotice message={authError} />;
  }

  // The page renders in full on the server and while the session loads, so
  // the content is visible (and indexable) at once; only the actions wait.
  const isDisabled = isSubmitting || authLoading || !userId;
  const isMineLoading = !isInitialized || mineState === "loading";

  const nameField = (id: string) =>
    displayName && !isEditingName ? (
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-muted px-4 py-3 text-sm">
        <span className="text-muted-foreground">You appear as</span>
        <span className="font-bold">{username || displayName}</span>
        <button
          className="ml-auto font-semibold text-sm underline underline-offset-2 hover:text-brand-text"
          onClick={() => setIsEditingName(true)}
          type="button"
        >
          Change
        </button>
      </p>
    ) : (
      <div className="space-y-2">
        <Label className="font-bold text-sm" htmlFor={id}>
          Your name
        </Label>
        <Input
          autoComplete="name"
          autoFocus={isEditingName}
          className="h-11 rounded-xl border-2 border-border bg-background px-4 text-base"
          id={id}
          maxLength={USERNAME_MAX_LENGTH}
          name="username"
          onChange={(e) => setUsername(e.target.value)}
          placeholder="How others will see you"
          required
          value={username}
        />
      </div>
    );

  const errorBox = error ? (
    <p
      className="rounded-xl border-2 border-destructive/30 bg-destructive/10 px-4 py-3 font-bold text-destructive text-sm"
      role="alert"
    >
      {error}
    </p>
  ) : null;

  return (
    <div className="relative flex min-h-dvh flex-col bg-canvas">
      <SiteHeader />
      {/* Wayfindr-style amber hero band; the form card overlaps its edge. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-16 h-[17.5rem] rounded-b-[2.5rem] bg-primary sm:h-[16rem] md:h-[18rem] md:rounded-b-[4rem] dark:bg-muted"
      />
      <main className="relative mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-8 md:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-10">
        {/* On phones the sections flatten into one list so that your own
            sessions come right after the form, before the feature list. */}
        <div className="max-lg:contents lg:space-y-6">
          <section
            aria-labelledby="landing-heading"
            className="space-y-2 max-lg:order-1 md:space-y-3"
          >
            <p className="font-bold text-foreground/70 text-sm uppercase tracking-wide">
              {eyebrow}
            </p>
            <h1
              className="font-black text-2xl leading-tight sm:text-3xl md:text-4xl"
              id="landing-heading"
            >
              {heading}
            </h1>
            <p className="max-w-prose text-base text-foreground/80 md:text-lg">
              {description}
            </p>
          </section>

          <div className="overflow-hidden rounded-2xl border-2 border-border bg-background shadow-lg max-lg:order-2">
            <Tabs
              className="w-full gap-0"
              defaultValue="create"
              onValueChange={() => setError("")}
            >
              <TabsList className="grid h-auto w-full grid-cols-2 rounded-none border-border border-b-2 bg-muted p-0">
                <TabsTrigger className={tabTriggerClass} value="create">
                  <Plus aria-hidden="true" className="h-5 w-5" />
                  Create
                </TabsTrigger>
                <TabsTrigger className={tabTriggerClass} value="join">
                  <LogIn aria-hidden="true" className="h-5 w-5" />
                  Join
                </TabsTrigger>
              </TabsList>

              <TabsContent className="mt-0 p-5 md:p-7" value="create">
                <form className="space-y-5" onSubmit={handleCreate}>
                  {nameField("create-username")}
                  <div className="space-y-2">
                    <Label className="font-bold text-sm" htmlFor="create-title">
                      Title{" "}
                      <span className="font-normal text-muted-foreground">
                        (optional)
                      </span>
                    </Label>
                    <Input
                      autoComplete="off"
                      className="h-11 rounded-xl border-2 border-border bg-background px-4 text-base"
                      id="create-title"
                      maxLength={FIELD_LIMITS.sessionTitle}
                      name="title"
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={titlePlaceholder}
                      value={title}
                    />
                  </div>
                  {organizations.length > 0 && (
                    <div className="space-y-2">
                      <Label
                        className="font-bold text-sm"
                        htmlFor="create-owner"
                      >
                        Belongs to
                      </Label>
                      <Select onValueChange={setOwnerOrgId} value={ownerOrgId}>
                        <SelectTrigger
                          className="h-11 w-full rounded-xl border-2 border-border bg-background px-4 text-base"
                          id="create-owner"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={PERSONAL_OWNER}>
                            Only me (personal)
                          </SelectItem>
                          {organizations.map((org) => (
                            <SelectItem key={org.id} value={org.id}>
                              <span className="flex items-center gap-2">
                                <Building2
                                  aria-hidden="true"
                                  className="h-4 w-4"
                                />
                                {org.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {ownerOrgId !== PERSONAL_OWNER && (
                        <p className="text-muted-foreground text-xs">
                          Members can open it even when private, and owners and
                          admins can host it.
                        </p>
                      )}
                    </div>
                  )}
                  {createExtras}
                  {errorBox}
                  <Button
                    className="h-12 w-full rounded-xl border-2 border-border font-bold text-base shadow-md"
                    disabled={isDisabled}
                    type="submit"
                  >
                    {isSubmitting ? "Creating…" : createLabel}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent className="mt-0 p-5 md:p-7" value="join">
                <form className="space-y-5" onSubmit={handleJoin}>
                  {nameField("join-username")}
                  <div className="space-y-2">
                    <Label className="font-bold text-sm" htmlFor="join-code">
                      Session code or link
                    </Label>
                    <Input
                      autoCapitalize="off"
                      autoComplete="off"
                      className="h-11 rounded-xl border-2 border-border bg-background px-4 font-mono text-base"
                      id="join-code"
                      name="sessionCode"
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="swift-falcon-1234"
                      required
                      spellCheck={false}
                      value={code}
                    />
                  </div>
                  {errorBox}
                  <Button
                    className="h-12 w-full rounded-xl border-2 border-border font-bold text-base shadow-md"
                    disabled={isDisabled}
                    type="submit"
                  >
                    {isSubmitting ? "Joining…" : "Join"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>

          <ul className="grid grid-cols-3 gap-2 max-lg:order-4 sm:gap-3">
            {features.map(
              ({ icon: Icon, title: featureTitle, description: text }) => (
                <li
                  className="rounded-xl border-2 border-border/60 bg-background/60 p-2.5 sm:p-3"
                  key={featureTitle}
                >
                  <Icon aria-hidden="true" className="mb-1.5 h-5 w-5" />
                  <p className="font-bold text-xs sm:text-sm">{featureTitle}</p>
                  <p className="hidden text-muted-foreground text-xs sm:block">
                    {text}
                  </p>
                </li>
              )
            )}
          </ul>
        </div>

        <aside
          aria-label={`Your ${noun}s`}
          className={cn(
            "h-fit overflow-hidden rounded-2xl border-2 border-border bg-background shadow-md max-lg:order-3 lg:sticky lg:top-6",
            // A first visit on a phone has nothing to list yet. It stays
            // hidden while loading too, rather than appearing and vanishing
            // and shifting the page under the visitor.
            mine.length === 0 && recentItems.length === 0 && "max-lg:hidden"
          )}
        >
          <Tabs className="w-full gap-0" defaultValue="mine">
            <TabsList className="grid h-auto w-full grid-cols-2 rounded-none border-border border-b-2 bg-muted p-0">
              <TabsTrigger className={tabTriggerClass} value="mine">
                <UserRound aria-hidden="true" className="h-4 w-4" />
                Yours
                {mine.length > 0 && (
                  <span className="rounded-full bg-primary px-1.5 text-primary-foreground text-xs">
                    {mine.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger className={tabTriggerClass} value="recent">
                <History aria-hidden="true" className="h-4 w-4" />
                Recent
              </TabsTrigger>
            </TabsList>
            <TabsContent
              className={cn(
                "mt-0 max-h-[28rem] overflow-y-auto p-4",
                isMineLoading && "animate-pulse"
              )}
              value="mine"
            >
              {mineState === "error" ? (
                <p className="text-destructive text-sm" role="alert">
                  Could not load your {noun}s right now.
                </p>
              ) : isMineLoading && mine.length === 0 ? (
                <p className="text-muted-foreground text-sm">Loading…</p>
              ) : (
                <SessionList
                  emptyMessage={`${noun.charAt(0).toUpperCase()}${noun.slice(1)}s you create appear here.`}
                  items={mine}
                  pathPrefix={pathPrefix}
                  timestampLabel="updated"
                />
              )}
            </TabsContent>
            <TabsContent
              className="mt-0 max-h-[28rem] overflow-y-auto p-4"
              value="recent"
            >
              <SessionList
                emptyMessage={`${noun.charAt(0).toUpperCase()}${noun.slice(1)}s you open in this browser appear here.`}
                items={recentItems}
                onRemove={handleRemoveRecent}
                pathPrefix={pathPrefix}
                timestampLabel="visited"
              />
            </TabsContent>
          </Tabs>
          <div className="border-border border-t-2 px-4 py-3">
            <Link
              className="flex items-center justify-between gap-2 font-bold text-sm hover:text-brand-text"
              href="/account/sessions"
            >
              Manage all sessions
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </aside>
      </main>
    </div>
  );
}
