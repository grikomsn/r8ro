# Retro Boards

## Creation and Joining

- `app/client-page.tsx` creates boards directly through the browser Supabase
  client and inserts the author into `retro_participants`.
- `/new` is a separate GET route that creates an untitled board for the
  authenticated user.
- Joining by slug verifies that the board can be selected, stores it in recent
  history, and opens `/retro/[slug]`.
- `hooks/use-auth.ts` supplies an anonymous Supabase user when no session
  exists.

## Board Behavior

- Cards use `went_well`, `to_improve`, or `action_items` as `column_type`.
- Participants on an unlocked accessible board can add, edit, move, delete,
  and vote on cards. Neither the UI nor the latest retro card policies limit
  edit/delete operations to the card author.
- `retro_card_votes` stores at most one vote per user and card. The count
  shown on a card comes from `retro_cards.votes`, which the database
  maintains, so it stays correct across clients and reconnects.
- Deleting a card is confirmed before it happens, because it removes the card
  and its votes for every participant.
- The author can change the title, visibility, lock state, timer, and delete
  the board.
- A locked board is frozen: nobody can add, edit, move, delete, vote, or
  unvote a card on it. The board author cannot bypass the lock either.
- A private board stays visible to the people already on it. Only the author
  and existing participants keep access; everybody else is treated as if the
  board did not exist.

## Realtime

`app/retro/[slug]/RetroPageClient.tsx` subscribes to board, card, participant,
and vote changes on `retro-${slug}`. Supabase Presence and the
`retro_participants.is_online` field drive online status. Visibility and unload
handlers track or untrack the current user.

## Main Components

- `components/retro/board-header.tsx`
- `components/retro/board-bottom-nav.tsx`
- `components/retro/retro-column.tsx`
- `components/retro/timer-settings.tsx`
- `components/shared/participants-panel.tsx`
- `components/shared/private-access-overlay.tsx`

The current SQL rules are summarized in
[../data-model/supabase.md](../data-model/supabase.md) and defined in
`supabase/migrations/20241231000000_create_retro_tables.sql` plus
`supabase/migrations/20260106123000_update_retro_policies.sql`.
