"use client";

import {
  ArrowRight,
  Building2,
  Download,
  LayoutList,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LinkGitHubCard } from "@/components/auth/link-github-card";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { RoleBadge } from "@/components/orgs/role-badge";
import { AuthErrorNotice } from "@/components/shared/auth-error-notice";
import { Avatar } from "@/components/shared/avatar";
import { FullPageLoading } from "@/components/shared/full-page-status";
import { PageShell, Panel } from "@/components/shared/page-shell";
import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import {
  USERNAME_MAX_LENGTH,
  validateUsername,
} from "@/lib/constants/username";
import { listMyOrganizations } from "@/lib/organizations";
import type { OrganizationSummary } from "@/lib/types";
import { reportActionError } from "@/lib/utils/errors";
import { exportMyData } from "@/lib/utils/export-my-data";

function ProfileForm() {
  const { displayName, updateDisplayName } = useAuth();
  const [name, setName] = useState(displayName);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(displayName);
  }, [displayName]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validateUsername(name);
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsSaving(true);
    const saved = await updateDisplayName(name.trim());
    setIsSaving(false);
    if (!saved) {
      setError("Could not save your name. Please try again.");
      return;
    }
    toast.success("Name updated", {
      description: "Boards and sessions you open show your new name.",
    });
  };

  const unchanged = name.trim() === displayName;

  return (
    <form className="space-y-2" onSubmit={handleSubmit}>
      <Label className="font-bold" htmlFor="account-display-name">
        Display name
      </Label>
      <div className="flex flex-wrap gap-2">
        <Input
          aria-describedby={error ? "account-name-error" : undefined}
          aria-invalid={!!error}
          autoComplete="name"
          className="h-11 min-w-0 flex-1 basis-56 rounded-xl border-2 border-border"
          id="account-display-name"
          maxLength={USERNAME_MAX_LENGTH}
          onChange={(event) => {
            setName(event.target.value);
            setError("");
          }}
          placeholder="How others will see you"
          value={name}
        />
        <Button
          className="h-11 rounded-xl font-bold"
          disabled={isSaving || unchanged}
          type="submit"
        >
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </div>
      {error ? (
        <p
          className="text-destructive text-sm"
          id="account-name-error"
          role="alert"
        >
          {error}
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">
          Shown on cards, votes and member lists. Sessions you already joined
          keep the name you used there.
        </p>
      )}
    </form>
  );
}

function OrganizationsSummary() {
  const [organizations, setOrganizations] = useState<
    OrganizationSummary[] | null
  >(null);

  useEffect(() => {
    let isMounted = true;
    listMyOrganizations()
      .then((rows) => {
        if (isMounted) {
          setOrganizations(rows);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setOrganizations([]);
          reportActionError("Load organizations", error);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  if (organizations === null) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (organizations.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        You are not in an organization yet.{" "}
        <Link
          className="font-semibold text-foreground underline underline-offset-2 hover:text-brand-text"
          href="/orgs"
        >
          Create one
        </Link>{" "}
        or open an invite link from a teammate.
      </p>
    );
  }

  return (
    <ul className="grid gap-2">
      {organizations.map((org) => (
        <li key={org.id}>
          <Link
            className="group flex items-center gap-3 rounded-xl border-2 border-border px-4 py-3 transition-colors hover:border-primary focus-visible:border-primary focus-visible:outline-none"
            href={`/orgs/${org.slug}`}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{org.name}</span>
              <span className="text-muted-foreground text-xs">
                {org.member_count} member{org.member_count === 1 ? "" : "s"}
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
  );
}

export default function AccountClientPage() {
  const {
    authError,
    avatarUrl,
    displayName,
    githubUsername,
    isAnonymous,
    isGitHubLinked,
    isInitialized,
    userId,
  } = useAuth();
  const [isExporting, setIsExporting] = useState(false);

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

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportMyData();
    } catch (error) {
      reportActionError("Export", error);
    } finally {
      setIsExporting(false);
    }
  };

  const name = displayName || "Guest";

  return (
    <PageShell
      actions={<SignOutButton />}
      description="Your profile, your organizations and your data."
      title="Account"
    >
      <Panel id="profile">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={name} size="lg" src={avatarUrl} />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate font-black text-xl">{name}</p>
            <p className="flex items-center gap-1.5 text-muted-foreground text-sm">
              {isAnonymous ? (
                <>
                  <UserRound aria-hidden="true" className="h-4 w-4" />
                  Guest on this browser
                </>
              ) : (
                <>
                  <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                  {githubUsername ? (
                    <>
                      Signed in with GitHub as{" "}
                      <span className="font-bold text-foreground">
                        @{githubUsername}
                      </span>
                    </>
                  ) : isGitHubLinked ? (
                    "Signed in with GitHub"
                  ) : (
                    "Registered account without GitHub"
                  )}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mt-6">
          <ProfileForm />
        </div>
        {isAnonymous && (
          <LinkGitHubCard
            body={
              <>
                A guest account lives in this browser only. Link GitHub to keep
                your boards on any device and to create or join organizations.
                If your GitHub account already has r8ro sessions, this browser's
                sessions are moved into it.
              </>
            }
            className="mt-6"
            title="Keep your sessions"
          />
        )}
      </Panel>

      <div className="grid gap-6 md:grid-cols-2">
        <Panel
          actions={
            <Button asChild className="rounded-lg" size="sm" variant="outline">
              <Link href="/account/sessions">
                <LayoutList aria-hidden="true" className="mr-2 h-4 w-4" />
                Open
              </Link>
            </Button>
          }
          description="Every retro and poker session you created or joined, with rename, archive and delete."
          id="sessions"
          title="My sessions"
        >
          <p className="text-muted-foreground text-sm">
            Sessions stay listed after the recent-visits list in this browser
            forgets them.
          </p>
        </Panel>

        <Panel
          actions={
            isGitHubLinked ? (
              <Button
                asChild
                className="rounded-lg"
                size="sm"
                variant="outline"
              >
                <Link href="/orgs">
                  <Building2 aria-hidden="true" className="mr-2 h-4 w-4" />
                  Manage
                </Link>
              </Button>
            ) : undefined
          }
          description="Share sessions with a team."
          id="organizations"
          title="Organizations"
        >
          {isGitHubLinked ? (
            <OrganizationsSummary />
          ) : (
            <p className="text-muted-foreground text-sm">
              Organizations need a GitHub-linked account.
            </p>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Panel id="appearance" title="Appearance">
          <ThemeSwitcher />
        </Panel>
        <Panel
          description="Everything you created or joined, as one JSON file."
          id="data"
          title="Your data"
        >
          <Button
            className="rounded-lg"
            disabled={isExporting}
            onClick={handleExport}
            variant="outline"
          >
            <Download aria-hidden="true" className="mr-2 h-4 w-4" />
            {isExporting ? "Preparing…" : "Export all my data"}
          </Button>
        </Panel>
      </div>
    </PageShell>
  );
}
