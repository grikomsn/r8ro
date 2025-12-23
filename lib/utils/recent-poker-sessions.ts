/** biome-ignore-all lint/suspicious/noDocumentCookie: we need to use document.cookie to store the recent poker sessions */

interface RecentPokerSession {
  slug: string;
  title: string;
  visitedAt: string;
}

export function getRecentPokerSessions(): RecentPokerSession[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const stored = document.cookie
      .split("; ")
      .find((row) => row.startsWith("recent_poker_sessions="))
      ?.split("=")[1];
    if (stored) {
      return JSON.parse(decodeURIComponent(stored));
    }
  } catch (e) {
    console.error("Failed to parse recent poker sessions", e);
  }
  return [];
}

export function addRecentPokerSession(slug: string, title: string) {
  const sessions = getRecentPokerSessions().filter((s) => s.slug !== slug);
  const newSession: RecentPokerSession = {
    slug,
    title,
    visitedAt: new Date().toISOString(),
  };
  const updated = [newSession, ...sessions].slice(0, 5); // Keep last 5 sessions
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString(); // 30 days
  document.cookie = `recent_poker_sessions=${encodeURIComponent(JSON.stringify(updated))}; expires=${expires}; path=/`;
}

export function removeRecentPokerSession(slug: string) {
  const sessions = getRecentPokerSessions().filter((s) => s.slug !== slug);
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `recent_poker_sessions=${encodeURIComponent(JSON.stringify(sessions))}; expires=${expires}; path=/`;
}

export type { RecentPokerSession };
