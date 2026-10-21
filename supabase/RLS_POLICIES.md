# Row Level Security Reference

SQL is authoritative. This file summarizes the policies created by
`20241231000000_create_retro_tables.sql`, `20250101000000_create_poker_tables.sql`,
`20260106123000_update_retro_policies.sql`, and
`20261021090600_enforce_poker_vote_rules.sql`.

`supabase/schema.sql` is a reference dump and is not applied.

## Retro

### `retro_boards`

- `boards_select_policy`: authenticated users can select public boards, boards
  they authored, or boards in which they are participants.
- `boards_insert_policy`: authenticated users can insert with themselves as
  author.
- `boards_update_policy` and `boards_delete_policy`: author only.

### `retro_participants`

- `participants_select_policy`: delegates to `can_access_board`.
- `participants_insert_policy`: self only, for a public board or its author.
- `participants_update_policy` and `participants_delete_policy`: self only.

### `retro_cards`

The 2026 policy migration replaces the baseline mutation policies:

- `cards_select_policy`: inherited from the accessible board.
- `retro_cards_insert_unlocked_or_author`: self-authored insert on an
  accessible board that is unlocked, or on a board the user authored.
- `retro_cards_update_unlocked_participants`: any participant or board author
  can update any card while allowed by the lock rule.
- `retro_cards_delete_unlocked_participants`: the same access rule for delete.

The update and delete policies do not compare `retro_cards.author_id` with the
current user. The identity columns of a card are protected by the
`prevent_card_identity_change` trigger instead, which rejects a change to
`id`, `board_id`, `author_id`, `author_name`, or to the `votes` counter.

### `retro_card_votes`

- `votes_select_policy`: inherited from the card's board.
- `retro_votes_insert_unlocked_participants`: self-owned vote on an accessible
  board that passes the lock rule.
- `retro_votes_delete_unlocked_participants`: self-owned vote with the same
  board access and lock checks.

The vote count shown on a card is `retro_cards.votes`, which the
`sync_retro_card_vote_count` trigger keeps in step with these rows.

## Poker

### `poker_sessions`

- Select: authenticated public access, authorship, or existing participation.
- Insert: authenticated user as author.
- Update/delete: author only.

### `poker_participants`

- Select: delegates to `can_access_poker_session`.
- Insert: self only, for a public session or its author.
- Update/delete: self only.

### `poker_votes`

- `poker_votes_select_policy`: a participant sees their own vote, and sees
  everybody's vote once the session is revealed.
- `poker_votes_insert_policy`: self only while voting is active, the user is
  not an observer, and the value is on the session's voting scale.
- `poker_votes_update_policy`: the same conditions for a vote change.
- `poker_votes_delete_policy`: self only.

The author clears every vote in their session with
`public.clear_poker_votes(session_id)`, which checks the session authorship
itself.

## Realtime

`20260106120000_enable_realtime_replication.sql` gives all application tables
`REPLICA IDENTITY FULL` and adds them to the `supabase_realtime` publication.
