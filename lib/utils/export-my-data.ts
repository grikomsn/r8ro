import { createClient } from "@/lib/supabase/client";

interface ExportBoard {
  board: Record<string, unknown>;
  cards: Record<string, unknown>[];
  participants: Record<string, unknown>[];
  votes: Record<string, unknown>[];
}

interface ExportPokerSession {
  participants: Record<string, unknown>[];
  session: Record<string, unknown>;
  votes: Record<string, unknown>[];
}

interface ExportPayload {
  exported_at: string;
  generator: string;
  poker_sessions: ExportPokerSession[];
  retro_boards: ExportBoard[];
  user: {
    id: string;
    display_name: string;
  };
}

// The Data API returns at most 1000 rows per request, so every collection is
// read in pages. A board with more than 1000 cards would otherwise be
// silently truncated.
const PAGE_SIZE = 1000;

// The pages are read one after another on purpose: each page is requested
// with an offset that depends on the previous page, so they cannot run in
// parallel.
async function fetchAll(
  fetchPage: (
    from: number,
    to: number
  ) => PromiseLike<{
    data: Record<string, unknown>[] | null;
    error: unknown;
  }>
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let from = 0;

  for (;;) {
    // biome-ignore lint/performance/noAwaitInLoops: the pages are sequential
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) {
      throw error;
    }

    const page = data ?? [];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      return rows;
    }

    from += PAGE_SIZE;
  }
}

/**
 * Builds a complete archive of everything the current user authored or
 * participated in, and downloads it as a JSON file.
 *
 * The export runs entirely in the browser using the user's own session, so it
 * keeps working right up until the backing service becomes unavailable. That
 * makes it the only reliable way to save data before a service shutdown.
 */
export async function exportMyData(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Not signed in");
  }

  const userId = user.id;

  // Boards the user authored.
  const authoredBoards = await fetchAll((from, to) =>
    supabase
      .from("retro_boards")
      .select("*")
      .eq("author_id", userId)
      .order("created_at", { ascending: true })
      .range(from, to)
  );

  // Boards the user joined. Their participation row proves membership, and the
  // read policies limit what can be read.
  const memberships = await fetchAll((from, to) =>
    supabase
      .from("retro_participants")
      .select("board_id")
      .eq("user_id", userId)
      .range(from, to)
  );

  const memberBoardIds = [
    ...new Set(
      memberships
        .map((row) => row.board_id)
        .filter((id): id is string => typeof id === "string")
    ),
  ];

  const joinedBoards = memberBoardIds.length
    ? await fetchAll((from, to) =>
        supabase
          .from("retro_boards")
          .select("*")
          .in("id", memberBoardIds)
          .order("created_at", { ascending: true })
          .range(from, to)
      )
    : [];

  // Deduplicate boards that are both authored and joined.
  const boardMap = new Map<string, Record<string, unknown>>();
  for (const board of [...authoredBoards, ...joinedBoards]) {
    const id = board.id;
    if (typeof id === "string") {
      boardMap.set(id, board);
    }
  }

  const retroBoards: ExportBoard[] = [];

  for (const board of boardMap.values()) {
    const boardId = board.id;
    if (typeof boardId !== "string") {
      continue;
    }

    // biome-ignore lint/performance/noAwaitInLoops: one board at a time
    const cards = await fetchAll((from, to) =>
      supabase
        .from("retro_cards")
        .select("*")
        .eq("board_id", boardId)
        .order("created_at", { ascending: true })
        .range(from, to)
    );

    const cardIds = cards
      .map((card) => card.id)
      .filter((id): id is string => typeof id === "string");

    const votes = cardIds.length
      ? await fetchAll((from, to) =>
          supabase
            .from("retro_card_votes")
            .select("*")
            .in("card_id", cardIds)
            .range(from, to)
        )
      : [];

    const participants = await fetchAll((from, to) =>
      supabase
        .from("retro_participants")
        .select("*")
        .eq("board_id", boardId)
        .range(from, to)
    );

    retroBoards.push({ board, cards, participants, votes });
  }

  // Poker sessions the user authored.
  const authoredSessions = await fetchAll((from, to) =>
    supabase
      .from("poker_sessions")
      .select("*")
      .eq("author_id", userId)
      .order("created_at", { ascending: true })
      .range(from, to)
  );

  const sessionMemberships = await fetchAll((from, to) =>
    supabase
      .from("poker_participants")
      .select("session_id")
      .eq("user_id", userId)
      .range(from, to)
  );

  const memberSessionIds = [
    ...new Set(
      sessionMemberships
        .map((row) => row.session_id)
        .filter((id): id is string => typeof id === "string")
    ),
  ];

  const joinedSessions = memberSessionIds.length
    ? await fetchAll((from, to) =>
        supabase
          .from("poker_sessions")
          .select("*")
          .in("id", memberSessionIds)
          .order("created_at", { ascending: true })
          .range(from, to)
      )
    : [];

  const sessionMap = new Map<string, Record<string, unknown>>();
  for (const session of [...authoredSessions, ...joinedSessions]) {
    const id = session.id;
    if (typeof id === "string") {
      sessionMap.set(id, session);
    }
  }

  const pokerSessions: ExportPokerSession[] = [];

  for (const session of sessionMap.values()) {
    const sessionId = session.id;
    if (typeof sessionId !== "string") {
      continue;
    }

    // biome-ignore lint/performance/noAwaitInLoops: one session at a time
    const votes = await fetchAll((from, to) =>
      supabase
        .from("poker_votes")
        .select("*")
        .eq("session_id", sessionId)
        .range(from, to)
    );

    const participants = await fetchAll((from, to) =>
      supabase
        .from("poker_participants")
        .select("*")
        .eq("session_id", sessionId)
        .range(from, to)
    );

    pokerSessions.push({ session, participants, votes });
  }

  const payload: ExportPayload = {
    exported_at: new Date().toISOString(),
    generator: "r8ro export",
    retro_boards: retroBoards,
    poker_sessions: pokerSessions,
    user: {
      id: userId,
      display_name: user.user_metadata?.display_name ?? "",
    },
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `r8ro-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
