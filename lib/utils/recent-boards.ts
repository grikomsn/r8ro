/** biome-ignore-all lint/suspicious/noDocumentCookie: we need to use document.cookie to store the recent boards */

interface RecentBoard {
  slug: string;
  title: string;
  visitedAt: string;
}

export function getRecentBoards(): RecentBoard[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const stored = document.cookie
      .split("; ")
      .find((row) => row.startsWith("recent_boards="))
      ?.split("=")[1];
    if (stored) {
      return JSON.parse(decodeURIComponent(stored));
    }
  } catch (e) {
    console.error("Failed to parse recent boards", e);
  }
  return [];
}

export function addRecentBoard(slug: string, title: string) {
  const boards = getRecentBoards().filter((b) => b.slug !== slug);
  const newBoard: RecentBoard = {
    slug,
    title,
    visitedAt: new Date().toISOString(),
  };
  const updated = [newBoard, ...boards].slice(0, 5); // Keep last 5 boards
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString(); // 30 days
  document.cookie = `recent_boards=${encodeURIComponent(JSON.stringify(updated))}; expires=${expires}; path=/`;
}

export function removeRecentBoard(slug: string) {
  const boards = getRecentBoards().filter((b) => b.slug !== slug);
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `recent_boards=${encodeURIComponent(JSON.stringify(boards))}; expires=${expires}; path=/`;
}

export type { RecentBoard };
