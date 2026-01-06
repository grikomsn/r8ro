# Retro Boards

Retro boards deliver a three-column retrospective workflow with realtime votes, timers, and privacy controls. This doc explains how the experience is stitched together so you can reason about behavior without re-reading every component.

## Lifecycle

1. **Landing (`app/client-page.tsx`)**
   - Anonymous auth runs via `useAuth`. Missing `displayName` triggers the join modal when a user first tries to enter a board.
   - Creating a board generates a slug (`generateSlug`), inserts into `retro_boards`, then upserts the author into `retro_participants` and stores the board in local `recentBoards`.
   - Joining only checks that a slug exists; RLS enforces privacy afterward.
2. **Server Entry (`app/retro/[slug]/page.tsx`)** surfaces metadata and renders `RetroPageClient` which handles all realtime logic.
3. **Client Load (`RetroPageClient.tsx`)**
   - Fetches board, cards, votes, and participants concurrently.
   - Ensures the viewing user has a `retro_participants` row (creating one if needed) and mirrors it locally for presence updates.

## Board State Fields

| Field | Description | Source |
| --- | --- | --- |
| `is_public` | Controls whether non-participants can view/join. | `retro_boards.is_public` toggled via BoardHeader actions. |
| `is_locked` | Blocks card/vote mutations for non-authors when true. | `retro_boards.is_locked`, enforced by RLS in `20260106123000_update_retro_policies.sql`. |
| `timer_running`, `timer_seconds`, `timer_started_at` | Manage the shared sprint timer shown in `BoardBottomNav`. | Stored on `retro_boards`; updates broadcast via realtime. |
| `column_type` | Categorizes cards as `went_well`, `to_improve`, or `action_items`. | `retro_cards.column_type`. |
| `votes` | Derived count per card by aggregating `retro_card_votes`. | Maintained optimistically in `RetroPageClient.tsx`. |

## Components & Responsibilities

- `components/retro/board-header.tsx` exposes visibility/lock toggles (author-only) and share helpers.
- `components/retro/retro-column.tsx` renders cards and enforces lock state for add/edit/delete/vote buttons.
- `components/retro/participants-list.tsx` + `PrivateBoardOverlay` gate access when a board is private and the viewer lacks `retro_participants` membership.
- `components/retro/timer-settings.tsx` adjusts duration and start/stop states for the shared timer.

## Realtime & Presence

`RetroPageClient` subscribes to four `postgres_changes` feeds plus Supabase Presence:

1. `retro_boards` rows for the active board → updates metadata or redirects if deleted.
2. `retro_cards` filtered by `board_id` → inserts/updates/deletes while preserving vote counts.
3. `retro_card_votes` → increments or decrements the local `votes` counter when toggled.
4. `retro_participants` filtered by `board_id` → keeps participant roster synced.
5. Presence `sync` events update `is_online` booleans so avatars fade when someone leaves.

Visibility + unload handlers (`document.visibilitychange`, `window.beforeunload`) write `is_online` back to Supabase and untrack/retrack the presence session to avoid ghost users.

## Permissions & Locking

- **Public Boards**: Anyone authenticated can load data, add cards, and vote.
- **Private Boards**: Only authors and existing participants pass the `can_access_board` helper, so joining requires being added previously.
- **Locked Boards**: All card/vote inserts, updates, and deletes are blocked unless the acting user is the author. The latest policies (migration `20260106123000_update_retro_policies.sql`) intentionally allow participants to keep editing while unlocked, mirroring the UI lock toggle.

## Rebuilding the Feature

1. Verify the schema using `docs/data-model/supabase.md` and the referenced migrations.
2. Ensure Supabase realtime publication includes every retro table (see `20260106120000_enable_realtime_replication.sql`).
3. Reuse the existing client structure: server component for initial data, client component for realtime, and shadcn/ui primitives for layout.
4. Keep the auth guard pattern: if `useAuth` has a user without `displayName`, pause at `JoinModal` before creating participant rows.
