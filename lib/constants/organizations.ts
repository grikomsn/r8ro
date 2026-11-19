import type { OrganizationRole } from "@/lib/types";

export const ORGANIZATION_ROLES: readonly OrganizationRole[] = [
  "owner",
  "admin",
  "member",
];

export const ROLE_LABELS: Record<OrganizationRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export const ROLE_DESCRIPTIONS: Record<OrganizationRole, string> = {
  owner: "Everything, including roles and deleting the organization.",
  admin: "Runs sessions, renames the organization and manages the invite link.",
  member: "Sees and joins the organization's sessions, and creates new ones.",
};

/** Owners and admins host every session of their organization. */
export function isOrgManager(role: OrganizationRole | null | undefined) {
  return role === "owner" || role === "admin";
}

/** Invite link lifetimes offered when a link is created or reset. */
export const INVITE_EXPIRY_OPTIONS = [
  { label: "1 day", value: 1 },
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "Never", value: null },
] as const;
