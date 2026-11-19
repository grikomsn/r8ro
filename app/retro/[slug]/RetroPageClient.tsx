"use client";

import { Lock } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  BoardHeader,
  type CardSortMode,
} from "@/components/retro/board-header";
import { MobileComposer } from "@/components/retro/mobile-composer";
import {
  COLUMN_CONFIG,
  COLUMN_ORDER,
  RetroColumn,
} from "@/components/retro/retro-column";
import { AuthErrorNotice } from "@/components/shared/auth-error-notice";
import {
  FullPageLoading,
  FullPageMessage,
} from "@/components/shared/full-page-status";
import { JoinSessionModal } from "@/components/shared/join-session-modal";
import { PrivateAccessOverlay } from "@/components/shared/private-access-overlay";
import { useAuth } from "@/hooks/use-auth";
import { useOrgRole } from "@/hooks/use-org-role";
import { computeRemainingSeconds, getTimerBase } from "@/hooks/use-retro-timer";
import { isOrgManager } from "@/lib/constants/organizations";
import { createClient } from "@/lib/supabase/client";
import type {
  ColumnType,
  RetroBoard,
  RetroCard,
  RetroParticipant,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { downloadTextFile } from "@/lib/utils/download";
import {
  getErrorMessage,
  reportActionError,
  throwIfNoRows,
  throwIfSupabaseError,
} from "@/lib/utils/errors";
import { retroToMarkdown } from "@/lib/utils/export-markdown";
import { addRecentBoard } from "@/lib/utils/recent-boards";
import { UNIQUE_VIOLATION_CODE } from "@/lib/utils/slug";

const SORT_STORAGE_KEY = "r8ro-retro-sort";

interface PresenceState {
  online_at: number;
  user_id: string;
  username: string;
}

function upsertById<T extends { id: string }>(list: T[], item: T) {
  const index = list.findIndex((existing) => existing.id === item.id);
  if (index === -1) {
    return [...list, item];
  }
  const next = [...list];
  next[index] = item;
  return next;
}

export default function RetroPageClient() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const {
    authError,
    userId,
    displayName,
    isInitialized: authInitialized,
  } = useAuth();

  const [board, setBoard] = useState<RetroBoard | null>(null);
  const [cards, setCards] = useState<RetroCard[]>([]);
  const [participants, setParticipants] = useState<RetroParticipant[]>([]);
  const [myVotes, setMyVotes] = useState<Set<string>>(() => new Set());
  const [userName, setUserName] = useState<string | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [activeColumn, setActiveColumn] = useState<ColumnType>("went_well");
  const [pendingActions, setPendingActions] = useState<Record<string, boolean>>(
    {}
  );

  // "auto" keeps cards in the order they were added while the board is open,
  // so they do not jump under someone's finger as others vote, and ranks them
  // by votes once the host locks the board for discussion. An explicit
  // choice is remembered per browser.
  const [sortMode, setSortMode] = useState<CardSortMode>("auto");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SORT_STORAGE_KEY);
      if (saved === "added" || saved === "votes" || saved === "auto") {
        setSortMode(saved);
      }
    } catch {
      // Storage can be unavailable, for example in a private window.
    }
  }, []);
  const handleSortChange = useCallback((mode: CardSortMode) => {
    setSortMode(mode);
    try {
      localStorage.setItem(SORT_STORAGE_KEY, mode);
    } catch {
      // Ignore; the choice still applies to this visit.
    }
  }, []);

  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const boardRef = useRef(board);
  const cardsRef = useRef(cards);
  const myVotesRef = useRef(myVotes);
  const hasSubscribedRef = useRef(false);
  boardRef.current = board;
  cardsRef.current = cards;
  myVotesRef.current = myVotes;

  const isAuthor = !!board && userId === board.author_id;
  // Owners and admins of the organization that owns the board host it too.
  const {
    isLoading: orgRoleLoading,
    organization,
    refresh: refreshOrgRole,
    role: orgRole,
  } = useOrgRole(board?.org_id ?? null);
  const isHost = isAuthor || isOrgManager(orgRole);

  const setPending = useCallback((key: string, value: boolean) => {
    setPendingActions((prev) => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    if (!authInitialized) {
      return;
    }

    if (authError) {
      // The session could not be verified, so the board can never load.
      setLoading(false);
      return;
    }

    if (displayName) {
      setUserName(displayName);
    } else if (userId) {
      setShowJoinModal(true);
      setLoading(false);
    }
  }, [authError, authInitialized, displayName, userId]);

  // Re-reads the board contents. Used on the initial load and again whenever
  // the realtime socket reconnects, because Postgres changes are not replayed
  // for a reconnect and anything missed while offline would be lost.
  const refetchBoard = useCallback(async () => {
    const supabase = createClient();

    const { data: boardData, error: boardError } = await supabase
      .from("retro_boards")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    throwIfSupabaseError(boardError, "Failed to load board");

    if (!boardData) {
      return null;
    }

    const [cardsRes, participantsRes] = await Promise.all([
      supabase
        .from("retro_cards")
        .select("*")
        .eq("board_id", boardData.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("retro_participants")
        .select("*")
        .eq("board_id", boardData.id),
    ]);

    throwIfSupabaseError(cardsRes.error, "Failed to load cards");
    throwIfSupabaseError(participantsRes.error, "Failed to load participants");

    const loadedCards: RetroCard[] = cardsRes.data ?? [];
    let votedCardIds = new Set<string>();

    if (userId && loadedCards.length > 0) {
      const { data: votes, error: votesError } = await supabase
        .from("retro_card_votes")
        .select("card_id")
        .eq("user_id", userId)
        .in(
          "card_id",
          loadedCards.map((card) => card.id)
        );
      throwIfSupabaseError(votesError, "Failed to load your votes");
      votedCardIds = new Set((votes ?? []).map((vote) => vote.card_id));
    }

    // The vote count is maintained in the database by
    // public.sync_retro_card_vote_count, so the card row is authoritative.
    setCards(loadedCards);
    setMyVotes(votedCardIds);
    setParticipants((previous) => {
      // Keep presence-derived online state for rows that already exist.
      const online = new Map(previous.map((p) => [p.user_id, p.is_online]));
      return (participantsRes.data ?? []).map((p) => ({
        ...p,
        is_online: online.get(p.user_id) ?? p.is_online,
      }));
    });

    return { board: boardData, participants: participantsRes.data ?? [] };
  }, [slug, userId]);

  useEffect(() => {
    if (!(userId && userName)) {
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    async function load() {
      try {
        const loaded = await refetchBoard();

        if (cancelled) {
          return;
        }

        if (!loaded) {
          setError("not-found");
          setLoading(false);
          return;
        }

        const { board: boardData, participants: loadedParticipants } = loaded;

        setBoard(boardData);
        addRecentBoard(boardData.slug, boardData.title);

        const existing = loadedParticipants.find((p) => p.user_id === userId);
        if (!existing) {
          const { error: upsertError } = await supabase
            .from("retro_participants")
            .upsert(
              {
                board_id: boardData.id,
                user_id: userId,
                username: userName,
                is_online: true,
              },
              {
                onConflict: "board_id,user_id",
                ignoreDuplicates: true,
              }
            );
          throwIfSupabaseError(upsertError, "Failed to join board");
        } else if (existing.username !== userName) {
          // The display name changed since the last visit.
          await supabase
            .from("retro_participants")
            .update({ username: userName })
            .eq("id", existing.id);
        }

        if (!cancelled) {
          setLoading(false);
        }
      } catch (loadError: unknown) {
        if (!cancelled) {
          console.error("Failed to load retro board:", loadError);
          setError(getErrorMessage(loadError, "Failed to load board"));
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId, userName, refetchBoard]);

  useEffect(() => {
    const boardId = board?.id;
    if (!(boardId && userId && userName)) {
      return;
    }

    const supabase = createClient();
    const channel = supabase.channel(`retro-${slug}`, {
      config: {
        // A private channel is authorised by the realtime.messages policies
        // added in 20261021090900_restrict_presence_channels.sql. Without it
        // any client could read the presence of a board that was made
        // private, because the topic is derived from the slug.
        private: true,
        presence: {
          key: userId,
        },
      },
    });

    const trackPresence = () =>
      channel.track({
        user_id: userId,
        username: userName,
        online_at: Date.now(),
      });

    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "retro_boards",
          filter: `id=eq.${boardId}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE" && payload.new) {
            const updated = payload.new as RetroBoard;
            const previous = boardRef.current;
            // The client that changed the lock already shows it
            // optimistically, so only the other clients, other hosts
            // included, see a difference here.
            if (previous && previous.is_locked !== updated.is_locked) {
              toast.info(
                updated.is_locked
                  ? "The host locked the board"
                  : "The host unlocked the board"
              );
            }
            setBoard(updated);
          } else if (payload.eventType === "DELETE") {
            toast.info("This board was deleted by the host");
            router.push("/");
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "retro_cards",
          filter: `board_id=eq.${boardId}`,
        },
        (payload) => {
          if (
            (payload.eventType === "INSERT" ||
              payload.eventType === "UPDATE") &&
            payload.new
          ) {
            // The database maintains the vote count, so the incoming card row
            // is authoritative.
            setCards((prev) => upsertById(prev, payload.new as RetroCard));
          } else if (payload.eventType === "DELETE") {
            setCards((prev) => prev.filter((c) => c.id !== payload.old.id));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "retro_participants",
          filter: `board_id=eq.${boardId}`,
        },
        (payload) => {
          if (
            (payload.eventType === "INSERT" ||
              payload.eventType === "UPDATE") &&
            payload.new
          ) {
            setParticipants((prev) =>
              upsertById(prev, payload.new as RetroParticipant)
            );
          } else if (payload.eventType === "DELETE") {
            setParticipants((prev) =>
              prev.filter((part) => part.id !== payload.old.id)
            );
          }
        }
      )
      .on("presence", { event: "sync" }, () => {
        const presenceState = channel.presenceState<PresenceState>();
        const onlineUserIds = new Set<string>();

        for (const presences of Object.values(presenceState)) {
          const presence = presences?.[0];
          if (presence?.user_id) {
            onlineUserIds.add(presence.user_id);
          }
        }

        setParticipants((prev) =>
          prev.map((part) => ({
            ...part,
            is_online: onlineUserIds.has(part.user_id),
          }))
        );
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await trackPresence();

          // Postgres changes are not replayed for a reconnect, so anything
          // that happened while the socket was down is missing. Re-read the
          // board to reconcile. The first subscription is skipped because the
          // load effect has just run.
          if (hasSubscribedRef.current) {
            refetchBoard()
              .then((loaded) => {
                if (loaded) {
                  setBoard(loaded.board);
                }
              })
              .catch((refreshError) => {
                console.error("Failed to refresh board:", refreshError);
              });
          }
          hasSubscribedRef.current = true;
        }
      });

    const setOnline = async (isOnline: boolean) => {
      const { error: updateError } = await supabase
        .from("retro_participants")
        .update({ is_online: isOnline })
        .eq("user_id", userId)
        .eq("board_id", boardId);
      if (updateError) {
        console.error("Failed to update participant status:", updateError);
      }
    };

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "hidden") {
        await setOnline(false);
        await channel.untrack();
      } else if (document.visibilityState === "visible") {
        await setOnline(true);
        await trackPresence();
      }
    };

    const handleBeforeUnload = () => {
      setOnline(false);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      channel.untrack().catch((untrackError) => {
        console.error("Failed to untrack presence:", untrackError);
      });
      channel.unsubscribe();
    };
  }, [board?.id, slug, userId, userName, router, refetchBoard]);

  const handleJoin = useCallback(
    (username: string) => {
      if (!userId) {
        return;
      }
      setUserName(username);
      setShowJoinModal(false);
      setLoading(true);
    },
    [userId]
  );

  /**
   * Applies a board change optimistically, writes it, and rolls back with a
   * visible error if the write is rejected.
   */
  const updateBoard = useCallback(
    async (key: string, patch: Partial<RetroBoard>, failureLabel: string) => {
      const current = boardRef.current;
      if (!current) {
        return false;
      }
      const previous: Partial<RetroBoard> = {};
      for (const field of Object.keys(patch) as (keyof RetroBoard)[]) {
        (previous as Record<string, unknown>)[field] = current[field];
      }

      setPending(key, true);
      setBoard((b) => (b ? { ...b, ...patch } : b));
      try {
        const { data: updated, error: updateError } = await createClient()
          .from("retro_boards")
          .update(patch)
          .eq("id", current.id)
          .select("id");
        throwIfSupabaseError(updateError, failureLabel);
        // Zero rows means you are no longer a host, for example because an
        // organization owner changed your role while the board was open.
        if (!updated || updated.length === 0) {
          refreshOrgRole();
        }
        throwIfNoRows(updated, "You can no longer change this board.");
        return true;
      } catch (updateError) {
        reportActionError(failureLabel, updateError);
        setBoard((b) => (b ? { ...b, ...previous } : b));
        return false;
      } finally {
        setPending(key, false);
      }
    },
    [setPending, refreshOrgRole]
  );

  const handleToggleVisibility = useCallback(async () => {
    const b = boardRef.current;
    if (!b) {
      return;
    }
    const ok = await updateBoard(
      "visibility",
      { is_public: !b.is_public },
      "Could not change visibility"
    );
    if (ok) {
      toast.success(
        b.is_public ? "Board is now private" : "Board is now public",
        {
          description: b.is_public
            ? "Only people already on the board keep access."
            : "Anyone with the link can join.",
        }
      );
    }
  }, [updateBoard]);

  const handleToggleLock = useCallback(async () => {
    const b = boardRef.current;
    if (!b) {
      return;
    }
    const ok = await updateBoard(
      "lock",
      { is_locked: !b.is_locked },
      b.is_locked ? "Could not unlock the board" : "Could not lock the board"
    );
    if (ok) {
      toast.success(b.is_locked ? "Board unlocked" : "Board locked", {
        description: b.is_locked
          ? "Everyone can add, move and vote on cards again."
          : "Cards and votes are frozen for everyone.",
      });
    }
  }, [updateBoard]);

  const handleToggleArchive = useCallback(async () => {
    const b = boardRef.current;
    if (!b) {
      return;
    }
    const archiving = !b.archived_at;
    const ok = await updateBoard(
      "archive",
      { archived_at: archiving ? new Date().toISOString() : null },
      archiving ? "Could not archive the board" : "Could not restore the board"
    );
    if (ok) {
      toast.success(archiving ? "Board archived" : "Board restored", {
        description: archiving
          ? "It moves to Archived in your sessions. Everyone can still open it."
          : "It is back in your active sessions.",
      });
    }
  }, [updateBoard]);

  const handleEditBoardTitle = useCallback(
    (title: string) =>
      updateBoard("title", { title }, "Could not rename the board"),
    [updateBoard]
  );

  const handleTimerToggle = useCallback(() => {
    const b = boardRef.current;
    if (!b) {
      return;
    }
    if (b.timer_running) {
      // Pause: remember what was left so that resume continues from there.
      return updateBoard(
        "timer",
        {
          timer_running: false,
          timer_started_at: null,
          timer_remaining_seconds: computeRemainingSeconds(b),
        },
        "Could not pause the timer"
      );
    }
    const base = getTimerBase(b);
    return updateBoard(
      "timer",
      {
        timer_running: true,
        timer_started_at: new Date().toISOString(),
        timer_remaining_seconds: base > 0 ? base : null,
      },
      "Could not start the timer"
    );
  }, [updateBoard]);

  const handleTimerReset = useCallback(
    () =>
      updateBoard(
        "timer",
        {
          timer_running: false,
          timer_started_at: null,
          timer_remaining_seconds: null,
        },
        "Could not reset the timer"
      ),
    [updateBoard]
  );

  const handleSetTimer = useCallback(
    (seconds: number) =>
      updateBoard(
        "timer",
        {
          timer_seconds: seconds,
          timer_running: false,
          timer_started_at: null,
          timer_remaining_seconds: null,
        },
        "Could not change the timer"
      ),
    [updateBoard]
  );

  const handleTimerExpire = useCallback(() => {
    toast.warning("Time's up!", { duration: 8000 });
  }, []);

  const handleDeleteBoard = useCallback(async () => {
    const b = boardRef.current;
    if (!b) {
      return;
    }
    setPending("deleteBoard", true);
    try {
      const { data: deleted, error: deleteError } = await createClient()
        .from("retro_boards")
        .delete()
        .eq("id", b.id)
        .select("id");
      throwIfSupabaseError(deleteError, "Failed to delete board");
      if (!deleted || deleted.length === 0) {
        refreshOrgRole();
      }
      throwIfNoRows(deleted, "You can no longer delete this board.");
      toast.success("Board deleted");
      router.push("/");
    } catch (deleteError) {
      reportActionError("Could not delete the board", deleteError);
    } finally {
      setPending("deleteBoard", false);
    }
  }, [router, setPending, refreshOrgRole]);

  const handleAddCard = useCallback(
    async (columnType: ColumnType, content: string) => {
      const b = boardRef.current;
      if (!(b && userId && userName)) {
        return;
      }
      const tempId = `temp-${crypto.randomUUID()}`;
      setCards((prev) => [
        ...prev,
        {
          id: tempId,
          board_id: b.id,
          column_type: columnType,
          content,
          author_name: userName,
          author_id: userId,
          votes: 0,
          created_at: new Date().toISOString(),
        },
      ]);
      try {
        const { data, error: insertError } = await createClient()
          .from("retro_cards")
          .insert({
            board_id: b.id,
            column_type: columnType,
            content,
            author_name: userName,
            author_id: userId,
          })
          .select()
          .single();

        throwIfSupabaseError(insertError, "Failed to add card");

        setCards((prev) => {
          const withoutTemp = prev.filter((c) => c.id !== tempId);
          // Realtime may already have delivered the row.
          return data
            ? upsertById(withoutTemp, data as RetroCard)
            : withoutTemp;
        });
      } catch (insertError) {
        reportActionError("Could not add the card", insertError);
        setCards((prev) => prev.filter((c) => c.id !== tempId));
      }
    },
    [userId, userName]
  );

  const handleVoteCard = useCallback(
    async (cardId: string) => {
      const key = `vote-${cardId}`;
      if (!userId) {
        return;
      }
      const hadVoted = myVotesRef.current.has(cardId);
      const delta = hadVoted ? -1 : 1;

      const applyLocal = (voted: boolean, change: number) => {
        setMyVotes((prev) => {
          const next = new Set(prev);
          if (voted) {
            next.add(cardId);
          } else {
            next.delete(cardId);
          }
          return next;
        });
        setCards((prev) =>
          prev.map((c) =>
            c.id === cardId ? { ...c, votes: Math.max(0, c.votes + change) } : c
          )
        );
      };

      setPending(key, true);
      applyLocal(!hadVoted, delta);
      const supabase = createClient();

      try {
        if (hadVoted) {
          const { error: deleteError } = await supabase
            .from("retro_card_votes")
            .delete()
            .eq("card_id", cardId)
            .eq("user_id", userId);
          throwIfSupabaseError(deleteError, "Failed to remove vote");
        } else {
          const { error: insertError } = await supabase
            .from("retro_card_votes")
            .insert({ card_id: cardId, user_id: userId });
          // A duplicate means another tab already voted, which is the state
          // the user asked for.
          if (insertError && insertError.code !== UNIQUE_VIOLATION_CODE) {
            throw new Error(insertError.message || "Failed to add vote");
          }
        }
      } catch (voteError) {
        reportActionError("Could not save your vote", voteError);
        applyLocal(hadVoted, -delta);
      } finally {
        setPending(key, false);
      }
    },
    [userId, setPending]
  );

  const handleDeleteCard = useCallback(
    async (cardId: string) => {
      const key = `delete-${cardId}`;
      const deletedCard = cardsRef.current.find((c) => c.id === cardId);

      setPending(key, true);
      setCards((prev) => prev.filter((c) => c.id !== cardId));
      try {
        const { error: deleteError } = await createClient()
          .from("retro_cards")
          .delete()
          .eq("id", cardId);
        throwIfSupabaseError(deleteError, "Failed to delete card");
      } catch (deleteError) {
        reportActionError("Could not delete the card", deleteError);
        if (deletedCard) {
          setCards((prev) => upsertById(prev, deletedCard));
        }
      } finally {
        setPending(key, false);
      }
    },
    [setPending]
  );

  const updateCard = useCallback(
    async (
      cardId: string,
      key: string,
      patch: Partial<Pick<RetroCard, "column_type" | "content">>,
      failureLabel: string
    ) => {
      const card = cardsRef.current.find((c) => c.id === cardId);
      if (!card) {
        return;
      }
      const previous = {
        column_type: card.column_type,
        content: card.content,
      };

      setPending(key, true);
      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, ...patch } : c))
      );
      try {
        const { error: updateError } = await createClient()
          .from("retro_cards")
          .update(patch)
          .eq("id", cardId);
        throwIfSupabaseError(updateError, failureLabel);
        return previous;
      } catch (updateError) {
        reportActionError(failureLabel, updateError);
        setCards((prev) =>
          prev.map((c) => (c.id === cardId ? { ...c, ...previous } : c))
        );
        return null;
      } finally {
        setPending(key, false);
      }
    },
    [setPending]
  );

  const handleEditCard = useCallback(
    (cardId: string, content: string) =>
      updateCard(
        cardId,
        `edit-${cardId}`,
        { content },
        "Could not edit the card"
      ),
    [updateCard]
  );

  const handleMoveCard = useCallback(
    async (cardId: string, columnType: ColumnType) => {
      const previous = await updateCard(
        cardId,
        `move-${cardId}`,
        { column_type: columnType },
        "Could not move the card"
      );
      if (!previous) {
        return;
      }
      // On phones the card leaves the visible column, so say where it went.
      toast.success(`Moved to “${COLUMN_CONFIG[columnType].title}”`, {
        action: {
          label: "Undo",
          onClick: () => {
            updateCard(
              cardId,
              `move-${cardId}`,
              { column_type: previous.column_type },
              "Could not undo the move"
            );
          },
        },
      });
    },
    [updateCard]
  );

  const participantNames = useMemo(
    () =>
      participants.map((p) => p.username).sort((a, b) => a.localeCompare(b)),
    [participants]
  );

  const buildMarkdown = useCallback(() => {
    const b = boardRef.current;
    return b ? retroToMarkdown(b, cardsRef.current, participantNames) : "";
  }, [participantNames]);

  const handleCopyMarkdown = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(buildMarkdown());
      toast.success("Markdown copied", {
        description: "Paste it into your wiki, ticket or chat.",
      });
    } catch (copyError) {
      reportActionError("Could not copy the Markdown", copyError);
    }
  }, [buildMarkdown]);

  const handleDownloadMarkdown = useCallback(() => {
    const b = boardRef.current;
    if (b) {
      downloadTextFile(`${b.slug}-retro.md`, buildMarkdown());
    }
  }, [buildMarkdown]);

  const cardsByColumn = useMemo(() => {
    const grouped: Record<ColumnType, RetroCard[]> = {
      went_well: [],
      to_improve: [],
      action_items: [],
    };
    for (const card of cards) {
      grouped[card.column_type]?.push(card);
    }
    return grouped;
  }, [cards]);

  if (!authInitialized) {
    return <FullPageLoading />;
  }

  if (authError) {
    return <AuthErrorNotice message={authError} />;
  }

  if (showJoinModal) {
    return <JoinSessionModal kind="retro" onJoin={handleJoin} slug={slug} />;
  }

  if (loading) {
    return <FullPageLoading label="Loading board…" />;
  }

  if (error || !board) {
    return error && error !== "not-found" ? (
      <FullPageMessage
        description={error}
        homeHref="/"
        title="Could not load this board"
      />
    ) : (
      <FullPageMessage
        description={`There is no board at “${slug}”. It may have been deleted, or the link may be mistyped.`}
        homeHref="/"
        title="Board not found"
      />
    );
  }

  // Existing participants keep access to a board the author made private.
  // The database allows this (the select policy includes participants), so
  // the client gate has to match it.
  const isParticipant = participants.some((p) => p.user_id === userId);

  // Members of the owning organization may open a private board before they
  // have a participant row, so wait for their role instead of flashing the
  // private notice.
  if (
    board.org_id &&
    orgRoleLoading &&
    !(board.is_public || isAuthor || isParticipant)
  ) {
    return <FullPageLoading label="Loading board…" />;
  }

  if (!(board.is_public || isAuthor || isParticipant || orgRole)) {
    return (
      <PrivateAccessOverlay
        description="The host made this board private. Only people who joined before then can open it. Ask the host to make it public again."
        homeHref="/"
        title="Private board"
      />
    );
  }

  const voteCount = cards.reduce((sum, card) => sum + card.votes, 0);
  const effectiveSortMode =
    sortMode === "auto" ? (board.is_locked ? "votes" : "added") : sortMode;

  // On phones one column is shown at a time; a horizontal swipe moves to the
  // neighbouring column.
  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    const touch = e.changedTouches[0];
    if (!(start && touch)) {
      return;
    }
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.6) {
      return;
    }
    const index = COLUMN_ORDER.indexOf(activeColumn);
    const next = COLUMN_ORDER[index + (dx < 0 ? 1 : -1)];
    if (next) {
      setActiveColumn(next);
    }
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas">
      <BoardHeader
        board={board}
        cardCount={cards.length}
        currentUserId={userId}
        isAuthor={isHost}
        onCopyMarkdown={handleCopyMarkdown}
        onDeleteBoard={handleDeleteBoard}
        onDownloadMarkdown={handleDownloadMarkdown}
        onSetTimer={handleSetTimer}
        onSortChange={handleSortChange}
        onTimerExpire={handleTimerExpire}
        onTimerReset={handleTimerReset}
        onTimerToggle={handleTimerToggle}
        onTitleUpdate={handleEditBoardTitle}
        onToggleArchive={handleToggleArchive}
        onToggleLock={handleToggleLock}
        onToggleVisibility={handleToggleVisibility}
        organization={organization}
        participants={participants}
        sortMode={sortMode}
        voteCount={voteCount}
      />

      {board.is_locked && (
        <div
          className="flex items-center justify-center gap-2 border-border border-b-2 bg-primary/15 px-3 py-1.5 text-sm"
          role="status"
        >
          <Lock aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span className="min-w-0 truncate">
            <strong>Locked for discussion.</strong>{" "}
            <span className="max-sm:hidden">Cards and votes are frozen.</span>
          </span>
          {isHost && (
            <button
              className="shrink-0 rounded font-bold underline underline-offset-2"
              onClick={handleToggleLock}
              type="button"
            >
              Unlock
            </button>
          )}
        </div>
      )}

      <main
        aria-label="Retro board"
        className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-2 p-2 md:p-4"
        data-board-capture
        onTouchEnd={handleTouchEnd}
        onTouchStart={(e) => {
          const touch = e.touches[0];
          touchStart.current = touch
            ? { x: touch.clientX, y: touch.clientY }
            : null;
        }}
      >
        <div
          aria-label="Columns"
          className="grid shrink-0 grid-cols-3 gap-1 rounded-xl border-2 border-border bg-muted p-1 md:hidden"
          role="tablist"
        >
          {COLUMN_ORDER.map((type) => (
            <button
              aria-selected={activeColumn === type}
              className={cn(
                "flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-1 py-2 font-bold text-xs transition-colors",
                activeColumn === type
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              )}
              key={type}
              onClick={() => setActiveColumn(type)}
              role="tab"
              type="button"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  COLUMN_CONFIG[type].dot
                )}
              />
              <span className="truncate">{COLUMN_CONFIG[type].title}</span>
              <span className="tabular-nums opacity-70">
                {cardsByColumn[type].length}
              </span>
            </button>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-3 md:gap-4">
          {COLUMN_ORDER.map((type) => (
            <div
              className={cn(
                "min-h-0 min-w-0",
                activeColumn === type ? "flex flex-col" : "hidden",
                "md:flex md:flex-col"
              )}
              key={type}
            >
              <RetroColumn
                cards={cardsByColumn[type]}
                columnType={type}
                currentUserId={userId ?? ""}
                draggedCardId={draggedCardId}
                isLocked={board.is_locked}
                myVotes={myVotes}
                onAddCard={handleAddCard}
                onDeleteCard={handleDeleteCard}
                onEditCard={handleEditCard}
                onMoveCard={handleMoveCard}
                onVoteCard={handleVoteCard}
                pendingActions={pendingActions}
                setDraggedCardId={setDraggedCardId}
                sortMode={effectiveSortMode}
              />
            </div>
          ))}
        </div>
      </main>

      {!board.is_locked && (
        <MobileComposer columnType={activeColumn} onAddCard={handleAddCard} />
      )}
    </div>
  );
}
