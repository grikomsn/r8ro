"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import type { OrganizationRole } from "@/lib/types";

interface OrgRoleState {
  isLoading: boolean;
  organization: { name: string; slug: string } | null;
  /** Reads the role again, for example after a host action was refused. */
  refresh: () => void;
  role: OrganizationRole | null;
}

interface LoadedRole {
  /** The organization and user the result belongs to. */
  base: string;
  organization: { name: string; slug: string } | null;
  role: OrganizationRole | null;
  version: number;
}

/**
 * Your role in the organization that owns a session, and the organization's
 * name for display. Resolves to no role at once when `orgId` is null, and to
 * no role and no organization when you are not a member.
 */
export function useOrgRole(orgId: string | null | undefined): OrgRoleState {
  const { userId } = useAuth();
  const [loaded, setLoaded] = useState<LoadedRole | null>(null);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((value) => value + 1), []);
  const base = orgId && userId ? `${orgId}:${userId}` : null;

  useEffect(() => {
    if (!(base && orgId && userId)) {
      return;
    }

    let isMounted = true;

    createClient()
      .from("organization_members")
      .select("role, organization:organizations(name, slug)")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!isMounted) {
          return;
        }
        if (error) {
          console.error("Failed to load organization role:", error);
        }
        const organization = data?.organization as unknown as
          | { name: string; slug: string }
          | null
          | undefined;
        setLoaded({
          base,
          organization: organization ?? null,
          role: (data?.role as OrganizationRole | undefined) ?? null,
          version,
        });
      });

    return () => {
      isMounted = false;
    };
  }, [base, orgId, userId, version]);

  if (!base) {
    // Without a signed-in user the role is unknown, not absent.
    return { isLoading: !!orgId, organization: null, refresh, role: null };
  }
  if (loaded?.base !== base) {
    // Derived rather than stored, so the render right after `orgId` changes
    // already reports loading instead of briefly reporting "no role".
    return { isLoading: true, organization: null, refresh, role: null };
  }
  // A refresh keeps showing the previous result until the new one arrives.
  return {
    isLoading: false,
    organization: loaded.organization,
    refresh,
    role: loaded.role,
  };
}

/**
 * User ids of the owners and admins of an organization, who co-host its
 * sessions. Pass null unless you are a member: the list is members-only.
 */
export function useOrgManagerIds(orgId: string | null | undefined) {
  const [loaded, setLoaded] = useState<{
    ids: ReadonlySet<string>;
    orgId: string;
  } | null>(null);

  useEffect(() => {
    if (!orgId) {
      return;
    }
    let isMounted = true;
    createClient()
      .rpc("list_organization_members", { p_org_id: orgId })
      .then(({ data, error }) => {
        if (!isMounted) {
          return;
        }
        if (error) {
          console.error("Failed to load organization hosts:", error);
        }
        const rows = (data ?? []) as { role: string; user_id: string }[];
        setLoaded({
          ids: new Set(
            rows
              .filter((row) => row.role === "owner" || row.role === "admin")
              .map((row) => row.user_id)
          ),
          orgId,
        });
      });
    return () => {
      isMounted = false;
    };
  }, [orgId]);

  return orgId && loaded?.orgId === orgId ? loaded.ids : EMPTY_IDS;
}

const EMPTY_IDS: ReadonlySet<string> = new Set();
