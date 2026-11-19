"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LinkGitHubCard } from "@/components/auth/link-github-card";
import {
  ManagedSessionList,
  type MoveTarget,
} from "@/components/sessions/managed-session-list";
import { StartSessionButtons } from "@/components/sessions/start-session-buttons";
import { AuthErrorNotice } from "@/components/shared/auth-error-notice";
import { FullPageLoading } from "@/components/shared/full-page-status";
import { PageShell, Panel } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { listMyOrganizations } from "@/lib/organizations";
import { listSessions } from "@/lib/sessions";
import type { ManagedSession } from "@/lib/types";
import { getErrorMessage } from "@/lib/utils/errors";

export default function MySessionsClientPage() {
  const { authError, isAnonymous, isGitHubLinked, isInitialized, userId } =
    useAuth();
  const [sessions, setSessions] = useState<ManagedSession[] | null>(null);
  const [moveTargets, setMoveTargets] = useState<MoveTarget[]>([]);
  const [loadError, setLoadError] = useState("");

  // A slower, older load never overwrites a newer one.
  const loadCountRef = useRef(0);
  const load = useCallback(async () => {
    loadCountRef.current += 1;
    const thisLoad = loadCountRef.current;
    try {
      const [rows, organizations] = await Promise.all([
        listSessions(),
        isGitHubLinked ? listMyOrganizations() : Promise.resolve([]),
      ]);
      if (thisLoad !== loadCountRef.current) {
        return;
      }
      setSessions(rows);
      setMoveTargets(organizations.map(({ id, name }) => ({ id, name })));
      setLoadError("");
    } catch (error) {
      if (thisLoad !== loadCountRef.current) {
        return;
      }
      console.error("Failed to load sessions:", error);
      setLoadError(getErrorMessage(error, "Could not load your sessions."));
    }
  }, [isGitHubLinked]);

  useEffect(() => {
    if (userId) {
      load();
    }
  }, [userId, load]);

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
      actions={<StartSessionButtons />}
      description="Retros and poker sessions you created or joined, including the ones your organizations share with you once you open them."
      eyebrow={
        <Link className="hover:text-foreground" href="/account">
          Account
        </Link>
      }
      title="My sessions"
    >
      {isAnonymous && (
        <LinkGitHubCard
          body="These sessions belong to this browser's guest account. Link GitHub to keep them on any device."
          title="Keep your sessions"
        />
      )}
      <Panel>
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
        ) : sessions === null ? (
          <p className="animate-pulse text-muted-foreground text-sm">
            Loading…
          </p>
        ) : (
          <ManagedSessionList
            emptyState={
              <div className="space-y-4 rounded-xl border-2 border-border border-dashed px-4 py-10 text-center">
                <p className="text-muted-foreground">
                  Sessions you create or join appear here.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <StartSessionButtons />
                </div>
              </div>
            }
            moveTargets={moveTargets}
            onChanged={load}
            sessions={sessions}
            showRelationFilter
            userId={userId}
          />
        )}
      </Panel>
    </PageShell>
  );
}
