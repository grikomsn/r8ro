# Retro Boards

## Creation and Joining

- `app/client-page.tsx` creates boards directly through the browser Supabase
  client (the landing UI is shared with poker in
  `components/shared/session-landing.tsx`) and inserts the author into `retro_participants`.
- A linked user who belongs to an organization can choose which
  organization the board belongs to ("Belongs to"); see
  [organizations.md](organizations.md).
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
  clicking it again.
- Card order is a per-browser choice in the board menu. "Automatic" (the
  default) keeps cards in the order they were added while the board is open,
  so they do not move under someone's finger as others vote, and ranks them by
  votes once the host locks the board for discussion. "Oldest first" and
  "Most votes" are fixed orders.
- Card text keeps line breaks. Enter adds or saves a card, Shift+Enter adds a
  new line, and Escape cancels. The add-card composer stays open so several
  cards can be added in a row.
- On phones one column is shown at a time, with a switcher that shows each
  column's card count; a horizontal swipe moves to the next column. Cards are
  added from a composer pinned to the bottom of the screen
  (`components/retro/mobile-composer.tsx`). Moving a card shows a notice with
  an Undo action, because on a phone it leaves the visible column.
- Each card has one menu with Edit, Move to another column, and Delete. On
  desktop it appears on hover or focus; cards can also be dragged between
  columns.
- A locked board shows a banner under the header; the host can unlock it from
  there.
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

- `components/shared/session-topbar.tsx`: the one-row header shared by retro
  boards and poker sessions.
- `components/retro/board-header.tsx`: title, session code, card and vote
  counts, timer, who is here, share and export, and the board menu (card
  order for everyone; lock, visibility and delete for the host). On phones
  sharing moves into the board menu.
- `components/retro/timer-control.tsx` and `hooks/use-retro-timer.ts`: the
  shared timer. Everyone sees it; the host gets start, pause, resume, reset,
  and duration presets in a popover.
- `components/retro/retro-column.tsx`
- `components/shared/presence-button.tsx`: avatars of the other people online,
  opening the full participant list.
- `components/shared/join-session-modal.tsx`: the first screen of a shared
  link for someone without a name yet. It shows the board title and host.
- `components/shared/private-access-overlay.tsx`

The current SQL rules are summarized in
[../data-model/supabase.md](../data-model/supabase.md) and defined in
`supabase/migrations/20241231000000_create_retro_tables.sql` plus
`supabase/migrations/20260106123000_update_retro_policies.sql`.

## Hosts and Archive

- The host is the author, or an owner or admin of the organization that owns
  the board. Hosts get the timer, lock, visibility, archive and delete
  controls. Card lock exemptions stay with the author.
- A private board of an organization stays open to its members.
- "Archive board" in the board menu files the board away; see
  [account.md](account.md#archive).
