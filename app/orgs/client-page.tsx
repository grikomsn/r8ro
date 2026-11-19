"use client";

import { ArrowRight, Building2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LinkGitHubCard } from "@/components/auth/link-github-card";
import { CreateOrganizationForm } from "@/components/orgs/create-organization-form";
import { RoleBadge } from "@/components/orgs/role-badge";
import { AuthErrorNotice } from "@/components/shared/auth-error-notice";
import { FullPageLoading } from "@/components/shared/full-page-status";
import { PageShell, Panel } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { listMyOrganizations } from "@/lib/organizations";
import type { OrganizationSummary } from "@/lib/types";
import { getErrorMessage } from "@/lib/utils/errors";

export default function OrganizationsClientPage() {
  const { authError, isAnonymous, isGitHubLinked, isInitialized, userId } =
    useAuth();
  // Organizations need a GitHub identity, not merely a non-guest account.
  const needsGitHub = !isGitHubLinked;
  const [organizations, setOrganizations] = useState<
    OrganizationSummary[] | null
  >(null);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    try {
      setOrganizations(await listMyOrganizations());
    } catch (error) {
      console.error("Failed to load organizations:", error);
      setLoadError(
        getErrorMessage(error, "Could not load your organizations.")
      );
    }
  }, []);

  useEffect(() => {
    if (userId && isGitHubLinked) {
      load();
    }
  }, [userId, isGitHubLinked, load]);

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

  return (
    <PageShell
      description="Share retros and poker sessions with your team. Members can open every session of the organization, and owners and admins can host them."
      title="Organizations"
    >
      {needsGitHub ? (
        <Panel>
          <LinkGitHubCard
            body={
              isAnonymous ? (
                <>
                  A guest account lives in this browser only, so it cannot own
                  or join an organization. Link GitHub to continue. If your
                  GitHub account already has r8ro sessions, this browser's
                  sessions are moved into it.
                </>
              ) : (
                "Organizations need an account signed in with GitHub, so that members can see who each other are."
              )
            }
            title="Organizations need a GitHub-linked account"
          />
        </Panel>
      ) : (
        <>
          <Panel id="your-organizations" title="Your organizations">
            {loadError ? (
              <div className="space-y-3" role="alert">
                <p className="text-destructive text-sm">{loadError}</p>
                <Button
                  className="rounded-lg"
                  onClick={load}
                  size="sm"
                  variant="outline"
                >
                  Try again
                </Button>
              </div>
            ) : organizations === null ? (
              <p className="animate-pulse text-muted-foreground text-sm">
                Loading…
              </p>
            ) : organizations.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-border border-dashed px-4 py-8 text-center">
                <Building2
                  aria-hidden="true"
                  className="h-8 w-8 text-muted-foreground"
                />
                <p className="text-muted-foreground">
                  Create an organization to share boards and sessions with your
                  team, or open an invite link from a teammate.
                </p>
              </div>
            ) : (
              <ul className="grid gap-2">
                {organizations.map((org) => (
                  <li key={org.id}>
                    <Link
                      className="group flex items-center gap-3 rounded-xl border-2 border-border bg-background px-4 py-3 shadow-sm transition-[border-color,box-shadow] hover:border-primary hover:shadow-md focus-visible:border-primary focus-visible:outline-none"
                      href={`/orgs/${org.slug}`}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage text-ink">
                        <Building2 aria-hidden="true" className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold">
                          {org.name}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {org.member_count} member
                          {org.member_count === 1 ? "" : "s"} ·{" "}
                          <span className="font-mono">{org.slug}</span>
                        </span>
                      </span>
                      <RoleBadge role={org.role} />
                      <ArrowRight
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel
            description="You become its owner. Invite people with a link afterwards."
            id="create-organization"
            title="Create an organization"
          >
            <CreateOrganizationForm />
          </Panel>
        </>
      )}
    </PageShell>
  );
}
