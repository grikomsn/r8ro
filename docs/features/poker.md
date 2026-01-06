# Scrum Poker Sessions

Planning poker extends the r8ro collaboration model with configurable voting scales, reveal controls, and observer roles. Use this doc to understand every moving piece before touching the feature.

## Lifecycle

1. **Landing (`app/poker/client-page.tsx`)**
   - Mirrors the retro landing page but adds voting-scale selection. The create flow seeds `poker_sessions` and adds the author to `poker_participants` with `is_observer=false`.
   - Join flow validates slugs, updates the viewer’s display name if needed, and lets RLS enforce private/public access.
2. **Server Entry (`app/poker/[slug]/page.tsx`)** simply renders `PokerSessionClient` with metadata for SEO.
3. **Client Load (`PokerSessionClient.tsx`)**
   - Fetches the session plus participants/votes, then upserts the viewer into `poker_participants`.
   - Stores session + vote refs locally for optimistic toggles (visibility, voting state, reveal, clear votes).

## Session State Fields

| Field | Description | Component Usage |
| --- | --- | --- |
| `voting_scale` | Ordered list of selectable values (Fibonacci, T-shirt, Linear, or custom). | `components/poker/voting-cards.tsx` renders cards directly from this array. |
| `is_voting_active` | Blocks card selection until the author starts a round. Defaults to `true` per migration `20251223151027_alter_poker_sessions_default_voting_active.sql`. | Admin toggle in `SessionHeader` → `handleToggleVoting`. |
| `votes_revealed` | Determines whether everyone sees numeric values or only “voted” checkmarks. | `ParticipantsTable` hides values until reveal. |
| `current_story` | Optional text describing the item being estimated. | Displayed + edited from `SessionHeader`. |
| `is_public` | Controls joining permissions just like retro boards. | Private overlay shown via `PrivateSessionOverlay`. |

## Components & Controls

- `SessionHeader` bundles title, story, participant count, and author-only settings (visibility, voting scale adjustments).
- `VotingCards` blocks observers or inactive voting states and highlights the user’s current pick.
- `ParticipantsTable` switches between anonymous tally mode (before reveal) and detailed statistics (after reveal). Stats highlight outliers and compute min/max/average for numeric scales.
- `SessionBottomNav` mirrors retro’s nav with quick actions for toggles, reveal, and clearing votes.
- `ParticipantsList` + `PrivateSessionOverlay` handle presence display and gating for private sessions.

## Realtime & Presence

`PokerSessionClient` subscribes to:

1. `poker_sessions` row updates for the active session (title/story/flags changes, deletion).
2. `poker_participants` filtered by `session_id` for join/leave/online state updates.
3. `poker_votes` filtered by `session_id` for inserts/updates/deletes.
4. Presence sync events to set `is_online` for each participant.

Just like retro boards, visibility + unload hooks ensure `is_online` stays accurate and that Supabase presence untracks cleanly when the tab hides.

## Permissions Overview

- **Sessions**: Only authors can mutate session metadata or delete; public/private visibility is enforced in RLS (see `docs/data-model/supabase.md`).
- **Participants**: A user can only edit/delete their row. Joining private sessions still requires RLS approval, so UI simply surfaces the denial.
- **Votes**: Users can insert/update votes only while `is_voting_active` is true and they are not marked as observers. Clearing votes issues a delete across `poker_votes` but is restricted to the author via UI controls.

## Rebuilding Checklist

1. Confirm schema via `docs/data-model/supabase.md` and re-run migrations if tables drift.
2. Keep realtime publication updated (see `20260106120000_enable_realtime_replication.sql`).
3. Maintain parity with retro auth patterns—anonymous join first, then display-name prompt if missing.
4. When adding new admin controls, ensure both UI and Supabase policies enforce the same rule.
5. For new voting scales or story tracking features, extend `lib/constants/poker-scales.ts` and surface them through the landing page + session header.
