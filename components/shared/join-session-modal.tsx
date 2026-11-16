"use client";

import { Crown, LayoutGrid, Spade } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useEffect, useState } from "react";
import { AppLogo } from "@/components/shared/app-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import {
  USERNAME_MAX_LENGTH,
  validateUsername,
} from "@/lib/constants/username";
import { createClient } from "@/lib/supabase/client";

interface JoinSessionModalProps {
  kind: "retro" | "poker";
  onJoin: (username: string) => void;
  slug: string;
}

interface SessionPreview {
  author_name: string;
  title: string;
}

/**
 * The first screen someone sees when they open a shared link without a name
 * yet. It says what they are joining and who runs it before asking for a
 * name.
 */
export function JoinSessionModal({
  kind,
  onJoin,
  slug,
}: JoinSessionModalProps) {
  const { displayName, updateDisplayName, isInitialized } = useAuth();
  const [username, setUsername] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<SessionPreview | null>(null);

  useEffect(() => {
    if (isInitialized && displayName) {
      setUsername(displayName);
    }
  }, [isInitialized, displayName]);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .from(kind === "retro" ? "retro_boards" : "poker_sessions")
      .select("title, author_name")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) {
          setPreview(data);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [kind, slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateUsername(username);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setIsSubmitting(true);

    const trimmed = username.trim();

    if (trimmed !== displayName) {
      const updated = await updateDisplayName(trimmed);
      if (!updated) {
        setIsSubmitting(false);
        setError("Could not save your name. Please try again.");
        return;
      }
    }

    onJoin(trimmed);
    setIsSubmitting(false);
  };

  const Icon = kind === "retro" ? LayoutGrid : Spade;
  const kindLabel = kind === "retro" ? "Retro board" : "Planning poker";
  const homeHref = kind === "retro" ? "/" : "/poker";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-canvas p-4">
      <AppLogo href={homeHref} />
      <div className="w-full max-w-md rounded-2xl border-2 border-border bg-background p-6 shadow-lg md:p-8">
        <p className="flex items-center gap-1.5 font-bold text-muted-foreground text-xs uppercase tracking-wide">
          <Icon aria-hidden="true" className="h-4 w-4" />
          {kindLabel}
        </p>
        <h1 className="mt-2 break-words font-black text-2xl">
          {preview?.title ?? "You're invited"}
        </h1>
        {preview && (
          <p className="mt-1 flex items-center gap-1.5 text-muted-foreground text-sm">
            <Crown
              aria-hidden="true"
              className="h-3.5 w-3.5 fill-primary text-primary"
            />
            Hosted by {preview.author_name}
          </p>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label className="font-bold text-sm" htmlFor="username">
              Your name
            </Label>
            <Input
              autoComplete="name"
              autoFocus
              className="h-12 rounded-xl border-2 border-border text-base"
              disabled={!isInitialized}
              id="username"
              maxLength={USERNAME_MAX_LENGTH}
              name="username"
              onChange={(e) => {
                setUsername(e.target.value);
                if (error) {
                  setError("");
                }
              }}
              placeholder="How others will see you"
              required
              value={username}
            />
            {error && (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            )}
          </div>
          <Button
            className="h-12 w-full rounded-xl font-bold text-base"
            disabled={isSubmitting || !isInitialized}
            type="submit"
          >
            {isSubmitting
              ? "Joining…"
              : kind === "retro"
                ? "Join the retro"
                : "Join the session"}
          </Button>
          <p className="text-center text-muted-foreground text-xs">
            No account needed. You can change your name later.
          </p>
        </form>
      </div>
      <Link
        className="text-muted-foreground text-sm underline underline-offset-2 hover:text-foreground"
        href={homeHref}
      >
        Start your own instead
      </Link>
    </div>
  );
}
