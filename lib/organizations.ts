import { createClient } from "@/lib/supabase/client";
import type {
  Organization,
  OrganizationInvite,
  OrganizationInvitePreview,
  OrganizationMember,
  OrganizationRole,
  OrganizationSummary,
} from "@/lib/types";
import { throwIfSupabaseError } from "@/lib/utils/errors";

// Every write to the organization tables goes through a SECURITY DEFINER
// function; the tables themselves are read-only to the browser. The database
// messages are written for people, so callers can show them as they are.

export async function listMyOrganizations(): Promise<OrganizationSummary[]> {
  const { data, error } = await createClient().rpc("list_my_organizations");
  throwIfSupabaseError(error, "Could not load your organizations");
  return (data ?? []) as OrganizationSummary[];
}

/** Returns null when the organization does not exist or you are not in it. */
export async function getOrganizationBySlug(
  slug: string
): Promise<Organization | null> {
  const { data, error } = await createClient()
    .from("organizations")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  throwIfSupabaseError(error, "Could not load the organization");
  return (data as Organization | null) ?? null;
}

export async function getMyOrganizationRole(
  orgId: string,
  userId: string
): Promise<OrganizationRole | null> {
  const { data, error } = await createClient()
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  throwIfSupabaseError(error, "Could not load your role");
  return (data?.role as OrganizationRole | undefined) ?? null;
}

export async function createOrganization(name: string): Promise<Organization> {
  const { data, error } = await createClient().rpc("create_organization", {
    p_name: name,
  });
  throwIfSupabaseError(error, "Could not create the organization");
  return data as Organization;
}

export async function renameOrganization(
  orgId: string,
  name: string
): Promise<Organization> {
  const { data, error } = await createClient().rpc("update_organization", {
    p_org_id: orgId,
    p_name: name,
  });
  throwIfSupabaseError(error, "Could not rename the organization");
  return data as Organization;
}

export async function deleteOrganization(orgId: string) {
  const { error } = await createClient().rpc("delete_organization", {
    p_org_id: orgId,
  });
  throwIfSupabaseError(error, "Could not delete the organization");
}

export async function listOrganizationMembers(
  orgId: string
): Promise<OrganizationMember[]> {
  const { data, error } = await createClient().rpc(
    "list_organization_members",
    { p_org_id: orgId }
  );
  throwIfSupabaseError(error, "Could not load the members");
  return (data ?? []) as OrganizationMember[];
}

export async function setMemberRole(
  orgId: string,
  userId: string,
  role: OrganizationRole
) {
  const { error } = await createClient().rpc("set_organization_member_role", {
    p_org_id: orgId,
    p_user_id: userId,
    p_role: role,
  });
  throwIfSupabaseError(error, "Could not change the role");
}

/** Removes a member, or leaves when `userId` is your own id. */
export async function removeMember(orgId: string, userId: string) {
  const { error } = await createClient().rpc("remove_organization_member", {
    p_org_id: orgId,
    p_user_id: userId,
  });
  throwIfSupabaseError(error, "Could not remove the member");
}

/** Readable by owners and admins only; null for everyone else. */
export async function getInvite(
  orgId: string
): Promise<OrganizationInvite | null> {
  const { data, error } = await createClient()
    .from("organization_invites")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();
  throwIfSupabaseError(error, "Could not load the invite link");
  return (data as OrganizationInvite | null) ?? null;
}

/** Creates the invite link, or replaces it so the old one stops working. */
export async function rotateInvite(
  orgId: string,
  expiresInDays: number | null
): Promise<OrganizationInvite> {
  const { data, error } = await createClient().rpc(
    "rotate_organization_invite",
    { p_org_id: orgId, p_expires_in_days: expiresInDays }
  );
  throwIfSupabaseError(error, "Could not create the invite link");
  return data as OrganizationInvite;
}

export async function revokeInvite(orgId: string) {
  const { error } = await createClient().rpc("revoke_organization_invite", {
    p_org_id: orgId,
  });
  throwIfSupabaseError(error, "Could not turn off the invite link");
}

export async function previewInvite(
  code: string
): Promise<OrganizationInvitePreview | null> {
  const { data, error } = await createClient().rpc("get_organization_invite", {
    p_code: code,
  });
  throwIfSupabaseError(error, "Could not load the invite");
  const rows = (data ?? []) as OrganizationInvitePreview[];
  return rows[0] ?? null;
}

/** Joins the organization and returns its slug. */
export async function acceptInvite(code: string): Promise<string> {
  const { data, error } = await createClient().rpc(
    "accept_organization_invite",
    { p_code: code }
  );
  throwIfSupabaseError(error, "Could not join the organization");
  return data as string;
}

export function inviteUrl(code: string) {
  const origin =
    typeof window === "undefined" ? "https://r8ro.app" : window.location.origin;
  return `${origin}/orgs/join/${code}`;
}
