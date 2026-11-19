import type { User } from "@supabase/supabase-js";

export interface GitHubProfile {
  avatarUrl: string | null;
  /** True when the account has a GitHub identity. */
  isLinked: boolean;
  username: string | null;
}

function readString(source: Record<string, unknown> | undefined, key: string) {
  const value = source?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Reads the GitHub avatar and handle of a linked account from its GitHub
 * identity. User metadata is not used: its owner can write anything there,
 * which is also why the database reads only the identity.
 */
export function getGitHubProfile(user: User | null): GitHubProfile {
  if (!user || user.is_anonymous) {
    return { avatarUrl: null, isLinked: false, username: null };
  }

  const identity = user.identities?.find((item) => item.provider === "github");
  if (!identity) {
    return { avatarUrl: null, isLinked: false, username: null };
  }
  const data = identity.identity_data as Record<string, unknown> | undefined;

  return {
    avatarUrl: readString(data, "avatar_url"),
    isLinked: true,
    username:
      readString(data, "user_name") ?? readString(data, "preferred_username"),
  };
}
