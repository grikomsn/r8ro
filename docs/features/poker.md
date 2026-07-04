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
  public/private state, start or stop voting, reveal or hide votes, and delete
  the session.
- Participants can create or update their own vote while voting is active.
- Vote values remain hidden until reveal, except that the current author can
  see their own vote.
- Revealed numeric values produce minimum, maximum, average, mode, and outlier
  indicators.
- The current client renders a private overlay for every non-author when
  `is_public` is false.

The UI includes a bulk clear-votes action, but the current
`poker_votes_delete_policy` permits users to delete only their own vote. Do not
describe multi-user clearing as supported until the policy and UI are aligned.

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
