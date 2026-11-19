"use client";

import { Building2, LayoutList, Settings, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { InvitePanel } from "@/components/orgs/invite-panel";
import { MembersPanel } from "@/components/orgs/members-panel";
import { OrganizationSettings } from "@/components/orgs/organization-settings";
import { RoleBadge } from "@/components/orgs/role-badge";
import {
  ManagedSessionList,
  type MoveTarget,
} from "@/components/sessions/managed-session-list";
import { StartSessionButtons } from "@/components/sessions/start-session-buttons";
import { AuthErrorNotice } from "@/components/shared/auth-error-notice";
import {
  FullPageLoading,
  FullPageMessage,
} from "@/components/shared/full-page-status";
import { PageShell } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { isOrgManager } from "@/lib/constants/organizations";
import {
  getOrganizationBySlug,
  listMyOrganizations,
  listOrganizationMembers,
} from "@/lib/organizations";
import { listSessions } from "@/lib/sessions";
import type {
  ManagedSession,
  Organization,
  OrganizationMember,
} from "@/lib/types";
import { getErrorMessage } from "@/lib/utils/errors";

const tabTriggerClass =
  "gap-2 rounded-none border-transparent border-b-4 py-3 font-bold text-sm data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:text-foreground";

interface OrgData {
  members: OrganizationMember[];
  moveTargets: MoveTarget[];
  organization: Organization;
  sessions: ManagedSession[];
  /** Which load produced this data; tells the invite panel to refresh. */
  version: number;
}

export default function OrgPageClient({ slug }: { slug: string }) {
  const { authError, isInitialized, userId } = useAuth();
  const [data, setData] = useState<OrgData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">(
    "loading"
  );
  const [loadError, setLoadError] = useState("");

  // Each load gets a number; a slower, older load never overwrites a newer
  // one, which matters when several actions finish in quick succession.
  const loadCountRef = useRef(0);
  const load = useCallback(async () => {
    loadCountRef.current += 1;
    const thisLoad = loadCountRef.current;
    const isCurrent = () => thisLoad === loadCountRef.current;
    try {
      const organization = await getOrganizationBySlug(slug);
      if (!isCurrent()) {
        return;
      }
      if (!organization) {
        setState("missing");
        return;
      }
      const [members, sessions, organizations] = await Promise.all([
        listOrganizationMembers(organization.id),
        listSessions(organization.id),
        listMyOrganizations(),
      ]);
      if (!isCurrent()) {
        return;
      }
      setData({
        members,
        moveTargets: organizations.map(({ id, name }) => ({ id, name })),
        organization,
        sessions,
        version: thisLoad,
      });
      setState("ready");
    } catch (error) {
      if (!isCurrent()) {
        return;
      }
      console.error("Failed to load organization:", error);
      setLoadError(getErrorMessage(error, "Could not load the organization."));
      setState("error");
    }
  }, [slug]);

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
  if (state === "missing") {
    return (
      <FullPageMessage
        description="It does not exist, or you are not a member. Ask an owner or admin for an invite link."
        homeHref="/orgs"
        homeLabel="Your organizations"
        icon={<Building2 aria-hidden="true" className="h-6 w-6" />}
        title="Organization not found"
      />
    );
  }
  if (state === "error") {
    return (
      <FullPageMessage
        description={loadError}
        homeHref="/orgs"
        homeLabel="Your organizations"
        primary={
          <Button className="rounded-lg font-bold" onClick={load}>
            Try again
          </Button>
        }
        title="Could not load the organization"
      />
    );
  }
  if (!data) {
    return <FullPageLoading label="Loading organization…" />;
  }

  const { members, moveTargets, organization, sessions } = data;
  const me = members.find((member) => member.user_id === userId);
  if (!me) {
    // The membership ended between two reads, for example by removal.
    return (
      <FullPageMessage
        description="You are no longer a member of this organization."
        homeHref="/orgs"
        homeLabel="Your organizations"
        icon={<Building2 aria-hidden="true" className="h-6 w-6" />}
        title="Organization not available"
      />
    );
  }
  const myRole = me.role;
  const ownerCount = members.filter((member) => member.role === "owner").length;
  const activeCount = sessions.filter((session) => !session.archived_at).length;

  return (
    <PageShell
      actions={<StartSessionButtons orgSlug={organization.slug} />}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <RoleBadge role={myRole} />
          <span>
            {members.length} member{members.length === 1 ? "" : "s"} ·{" "}
            {activeCount} active session{activeCount === 1 ? "" : "s"}
          </span>
        </span>
      }
      eyebrow={
        <Link className="hover:text-foreground" href="/orgs">
          Organizations
        </Link>
      }
      title={organization.name}
    >
      <div className="overflow-hidden rounded-2xl border-2 border-border bg-background shadow-md">
        <Tabs className="w-full gap-0" defaultValue="sessions">
          <TabsList className="grid h-auto w-full grid-cols-3 rounded-none border-border border-b-2 bg-muted p-0">
            <TabsTrigger className={tabTriggerClass} value="sessions">
              <LayoutList aria-hidden="true" className="h-4 w-4" />
              Sessions
            </TabsTrigger>
            <TabsTrigger className={tabTriggerClass} value="members">
              <Users aria-hidden="true" className="h-4 w-4" />
              Members
            </TabsTrigger>
            <TabsTrigger className={tabTriggerClass} value="settings">
              <Settings aria-hidden="true" className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent className="mt-0 p-4 md:p-6" value="sessions">
            <ManagedSessionList
              emptyState={
                <div className="space-y-4 rounded-xl border-2 border-border border-dashed px-4 py-10 text-center">
                  <p className="text-muted-foreground">
                    No sessions yet. Start one here, or move one of your own
                    sessions in from{" "}
                    <Link
                      className="font-semibold text-foreground underline underline-offset-2 hover:text-brand-text"
                      href="/account/sessions"
                    >
                      My sessions
                    </Link>
                    .
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <StartSessionButtons orgSlug={organization.slug} />
                  </div>
                </div>
              }
              moveTargets={moveTargets}
              onChanged={load}
              sessions={sessions}
              showOrganization={false}
              userId={userId}
            />
          </TabsContent>

          <TabsContent className="mt-0 space-y-6 p-4 md:p-6" value="members">
            {isOrgManager(myRole) && (
              <section
                aria-labelledby="invite-title"
                className="space-y-3 rounded-xl bg-muted p-4"
              >
                <h2 className="font-black" id="invite-title">
                  Invite people
                </h2>
                {/* Removing a member replaces the code, so the panel
                    reloads with the rest of the page. */}
                <InvitePanel
                  orgId={organization.id}
                  refreshToken={data.version}
                />
              </section>
            )}
            <MembersPanel
              members={members}
              myRole={myRole}
              onChanged={load}
              orgId={organization.id}
              orgName={organization.name}
              userId={userId}
            />
          </TabsContent>

          <TabsContent className="mt-0 space-y-8 p-4 md:p-6" value="settings">
            <OrganizationSettings
              isSoleOwner={myRole === "owner" && ownerCount <= 1}
              myRole={myRole}
              onRenamed={(renamed) =>
                setData((previous) =>
                  previous ? { ...previous, organization: renamed } : previous
                )
              }
              organization={organization}
              userId={userId}
            />
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}
