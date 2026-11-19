import { createClient } from "@/lib/supabase/client";
import type { ManagedSession, SessionKind } from "@/lib/types";
import { throwIfSupabaseError } from "@/lib/utils/errors";

const TABLES = {
  retro: "retro_boards",
  poker: "poker_sessions",
} as const satisfies Record<SessionKind, string>;

const PARTICIPANT_TABLES = {
  retro: { table: "retro_participants", key: "board_id" },
  poker: { table: "poker_participants", key: "session_id" },
} as const;

export function sessionHref(session: { kind: SessionKind; slug: string }) {
  return `/${session.kind}/${session.slug}`;
}

/**
 * Sessions you created or joined, or with `orgId` every session of that
 * organization. Each row says what you may do with it.
 */
export async function listSessions(orgId?: string): Promise<ManagedSession[]> {
  const { data, error } = await createClient().rpc("list_my_sessions", {
    p_org_id: orgId ?? null,
  });
  throwIfSupabaseError(error, "Could not load sessions");
  return ((data ?? []) as ManagedSession[]).map((row) => ({
    ...row,
    item_count: Number(row.item_count),
    participant_count: Number(row.participant_count),
  }));
}

async function updateSession(
  session: Pick<ManagedSession, "id" | "kind">,
  patch: Record<string, unknown>,
  failure: string
) {
  const { data, error } = await createClient()
    .from(TABLES[session.kind])
    .update(patch)
    .eq("id", session.id)
    .select("id");
  throwIfSupabaseError(error, failure);
  // RLS hides a row you may not change, which reads as zero rows updated.
  if (!data || data.length === 0) {
    throw new Error("You cannot change this session.");
  }
}

export function renameSession(
  session: Pick<ManagedSession, "id" | "kind">,
  title: string
) {
  return updateSession(session, { title }, "Could not rename the session");
}

export function setSessionVisibility(
  session: Pick<ManagedSession, "id" | "kind">,
  isPublic: boolean
) {
  return updateSession(
    session,
    { is_public: isPublic },
    "Could not change who can open the session"
  );
}

export function setRetroLocked(
  session: Pick<ManagedSession, "id">,
  isLocked: boolean
) {
  return updateSession(
    { id: session.id, kind: "retro" },
    { is_locked: isLocked },
    "Could not change the lock"
  );
}

export function setSessionArchived(
  session: Pick<ManagedSession, "id" | "kind">,
  archived: boolean
) {
  return updateSession(
    session,
    { archived_at: archived ? new Date().toISOString() : null },
    archived ? "Could not archive the session" : "Could not restore the session"
  );
}

export async function deleteSession(
  session: Pick<ManagedSession, "id" | "kind">
) {
  const { data, error } = await createClient()
    .from(TABLES[session.kind])
    .delete()
    .eq("id", session.id)
    .select("id");
  throwIfSupabaseError(error, "Could not delete the session");
  if (!data || data.length === 0) {
    throw new Error("You cannot delete this session.");
  }
}

/** Removes you from a session you joined; your cards stay on the board. */
export async function leaveSession(
  session: Pick<ManagedSession, "id" | "kind">,
  userId: string
) {
  const supabase = createClient();
  if (session.kind === "poker") {
    const { error: voteError } = await supabase
      .from("poker_votes")
      .delete()
      .eq("session_id", session.id)
      .eq("user_id", userId);
    throwIfSupabaseError(voteError, "Could not withdraw your vote");
  }
  const { table, key } = PARTICIPANT_TABLES[session.kind];
  const { error } = await supabase
    .from(table)
    .delete()
    .eq(key, session.id)
    .eq("user_id", userId);
  throwIfSupabaseError(error, "Could not leave the session");
}

/** Moves a session into an organization, or back to its author with null. */
export async function moveSession(
  session: Pick<ManagedSession, "id" | "kind">,
  orgId: string | null
) {
  const { error } = await createClient().rpc("set_session_organization", {
    p_kind: session.kind,
    p_session_id: session.id,
    p_org_id: orgId,
  });
  throwIfSupabaseError(error, "Could not move the session");
}
