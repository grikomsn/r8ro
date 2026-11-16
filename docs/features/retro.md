# Retro Boards

## Creation and Joining

- `app/client-page.tsx` creates boards directly through the browser Supabase
  client (the landing UI is shared with poker in
  `components/shared/session-landing.tsx`) and inserts the author into `retro_participants`.
- `/new` is a separate GET route that creates an untitled board for the
  authenticated user.
- Joining accepts a session code or a pasted link, verifies that the board
  can be selected, stores it in recent history, and opens `/retro/[slug]`.
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
- Each participant sees which cards they voted on, and can withdraw a vote by
  clicking it again. Cards are ordered by votes, then by creation time.
- Card text keeps line breaks. Enter adds or saves a card, Shift+Enter adds a
  new line, and Escape cancels. The add-card composer stays open so several
  cards can be added in a row.
- On phones one column is shown at a time, with a switcher that shows each
  column's card count.
- The author can change the title, visibility, lock state, timer, and delete
  the board.
- The timer pauses and resumes. `timer_seconds` is the configured duration
  and `timer_remaining_seconds` is what was left at the last pause; reset
  clears it. Changing the duration resets the timer. Everyone hears a short
  alarm and sees a notice when a running timer reaches zero.
- Anyone can copy the board as Markdown, download it as a `.md` file, or copy
  it as an image from the share menu. Action items are exported as a task
  list.
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

- `components/retro/board-header.tsx`: title, session code, card and vote
  counts, timer, participants toggle, share and export menu, host settings.
- `components/retro/timer-control.tsx` and `hooks/use-retro-timer.ts`: the
  shared timer. Everyone sees it; the host gets start, pause, resume, reset,
  and duration presets in a popover.
- `components/retro/retro-column.tsx`
- `components/shared/participants-panel.tsx`: docked on wide screens, a
  drawer otherwise.
- `components/shared/private-access-overlay.tsx`

The current SQL rules are summarized in
[../data-model/supabase.md](../data-model/supabase.md) and defined in
`supabase/migrations/20241231000000_create_retro_tables.sql` plus
`supabase/migrations/20260106123000_update_retro_policies.sql`.
