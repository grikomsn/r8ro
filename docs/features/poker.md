# Planning Poker

## Creation and Joining

- `app/poker/client-page.tsx` creates sessions and inserts the author into
  `poker_participants`.
- Available presets are defined in `lib/constants/poker-scales.ts`: Fibonacci,
  T-shirt sizes, and linear 1–10.
- Joining by slug verifies that the session can be selected, stores it in
  recent history, and opens `/poker/[slug]`.
- New and newly joined participant rows currently set `is_observer` to
  `false`; there is no observer-selection control in the UI.

## Session Behavior

- The author can edit the title and current story, change the scale, toggle
  public/private state, start or stop voting, reveal or hide votes, clear all
  votes, and delete the session.
- Participants can create or update their own vote while voting is active. A
  vote value must be on the session's voting scale.
- Vote values remain hidden until reveal. This is enforced by the database, so
  the values cannot be read through the API before the reveal either.
- Revealed numeric values produce minimum, maximum, average, mode, and outlier
  indicators. A non-numeric scale such as T-shirt sizes produces a vote
  distribution instead, because it has no minimum, maximum, or average.
- A private session stays visible to the people already on it. Only the author
  and existing participants keep access.

The bulk clear-votes action calls `clear_poker_votes(session_id)`, which
removes every vote in the session and is restricted to the session author.

## Realtime

`app/poker/[slug]/PokerSessionClient.tsx` subscribes to session, participant,
and vote changes on `poker-${slug}`. Supabase Presence and
`poker_participants.is_online` drive online status.

## Main Components

- `components/poker/session-header.tsx`
- `components/poker/session-bottom-nav.tsx`
- `components/poker/voting-cards.tsx`
- `components/poker/participants-table.tsx`
- `components/shared/participants-panel.tsx`
- `components/shared/private-access-overlay.tsx`

The table definitions and policies originate in
`supabase/migrations/20250101000000_create_poker_tables.sql`.
