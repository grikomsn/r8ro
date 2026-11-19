"use client";

import { Building2, Clock, LinkIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LinkGitHubCard } from "@/components/auth/link-github-card";
import { AppLogo } from "@/components/shared/app-logo";
import { AuthErrorNotice } from "@/components/shared/auth-error-notice";
import {
  FullPageLoading,
  FullPageMessage,
} from "@/components/shared/full-page-status";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { acceptInvite, previewInvite } from "@/lib/organizations";
import type { OrganizationInvitePreview } from "@/lib/types";
import { getErrorMessage } from "@/lib/utils/errors";

type PreviewState =
  | { status: "loading" }
  | { status: "invalid" }
  | { status: "error"; message: string }
  | { status: "ready"; invite: OrganizationInvitePreview };

/**
 * Shows who invited you before anything happens. Joining always takes an
 * explicit click, so opening a link can never make you a member.
 */
export default function JoinOrgClient({ code }: { code: string }) {
  const router = useRouter();
  const { authError, isAnonymous, isGitHubLinked, isInitialized, userId } =
    useAuth();
  const [preview, setPreview] = useState<PreviewState>({ status: "loading" });
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  useEffect(() => {
    if (!userId) {
      return;
    }
    let isMounted = true;
    previewInvite(code)
      .then((invite) => {
        if (!isMounted) {
          return;
        }
        setPreview(
          invite ? { status: "ready", invite } : { status: "invalid" }
        );
      })
      .catch((error) => {
        if (isMounted) {
          setPreview({
            status: "error",
            message: getErrorMessage(error, "Could not load the invite."),
          });
        }
      });
    return () => {
      isMounted = false;
    };
  }, [code, userId]);

  if (!isInitialized) {
    return <FullPageLoading />;
  }
  if (authError || !userId) {
    return (
      <AuthErrorNotice
        message={authError ?? "We could not start a session. Please retry."}
      />
    );
  }
  if (preview.status === "loading") {
    return <FullPageLoading label="Loading invite…" />;
  }
  if (preview.status === "invalid") {
    return (
      <FullPageMessage
        description="The link is wrong, or it was reset or turned off. Ask an owner or admin of the organization for a new one."
        homeHref="/orgs"
        homeLabel="Your organizations"
        icon={<LinkIcon aria-hidden="true" className="h-6 w-6" />}
        title="This invite link does not work"
      />
    );
  }
  if (preview.status === "error") {
    return (
      <FullPageMessage
        description={preview.message}
        homeHref="/"
        title="Could not load the invite"
      />
    );
  }

  const { invite } = preview;

  if (invite.is_member) {
    return (
      <FullPageMessage
        description={`You are already a member of ${invite.org_name}.`}
        homeHref="/orgs"
        homeLabel="Your organizations"
        icon={<Building2 aria-hidden="true" className="h-6 w-6" />}
        primary={
          <Button asChild className="rounded-lg font-bold">
            <Link href={`/orgs/${invite.org_slug}`}>
              Open {invite.org_name}
            </Link>
          </Button>
        }
        title="You are already in"
      />
    );
  }

  if (invite.is_expired) {
    return (
      <FullPageMessage
        description={`The invite link to ${invite.org_name} has expired. Ask an owner or admin for a new one.`}
        homeHref="/orgs"
        homeLabel="Your organizations"
        icon={<Clock aria-hidden="true" className="h-6 w-6" />}
        title="This invite has expired"
      />
    );
  }

  const handleJoin = async () => {
    setIsJoining(true);
    setJoinError("");
    try {
      const slug = await acceptInvite(code);
      router.replace(`/orgs/${slug}`);
    } catch (error) {
      setJoinError(getErrorMessage(error, "Could not join."));
      setIsJoining(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-canvas p-4">
      <AppLogo />
      <main className="w-full max-w-md space-y-5 rounded-2xl border-2 border-border bg-background p-6 shadow-md md:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sage text-ink">
          <Building2 aria-hidden="true" className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <p className="font-bold text-muted-foreground text-sm uppercase tracking-wide">
            You are invited to join
          </p>
          <h1 className="break-words font-black text-2xl">{invite.org_name}</h1>
          <p className="text-muted-foreground">
            {invite.member_count} member{invite.member_count === 1 ? "" : "s"}.
            Members can open every session of the organization, including
            private ones, and start new ones in it.
          </p>
        </div>

        {isGitHubLinked ? (
          <div className="space-y-3">
            {joinError && (
              <p
                className="rounded-xl border-2 border-destructive/30 bg-destructive/10 px-4 py-3 font-bold text-destructive text-sm"
                role="alert"
              >
                {joinError}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                className="h-11 flex-1 rounded-xl font-bold"
                disabled={isJoining}
                onClick={handleJoin}
              >
                {isJoining ? "Joining…" : `Join ${invite.org_name}`}
              </Button>
              <Button
                asChild
                className="h-11 rounded-xl font-bold"
                variant="outline"
              >
                <Link href="/">Not now</Link>
              </Button>
            </div>
          </div>
        ) : (
          <LinkGitHubCard
            body={
              isAnonymous
                ? "Organizations need a GitHub-linked account. You come back to this page afterwards. If your GitHub account already has r8ro sessions, this browser's sessions are moved into it."
                : "Organizations need an account signed in with GitHub, so that members can see who each other are."
            }
            title="Link GitHub to join"
          />
        )}
      </main>
    </div>
  );
}
