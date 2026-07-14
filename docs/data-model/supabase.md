# Supabase Data Model

The database definition is split across:

1. `supabase/schema.sql`, the retro baseline.
2. `supabase/migrations/*.sql`, applied in filename order.

SQL files are authoritative when this document differs.

## Tables

| Table | Purpose | Important constraints |
| --- | --- | --- |
| `retro_boards` | Board settings and timer state | Unique `slug`; author references `auth.users` |
| `retro_cards` | Cards in one of three columns | Board and author foreign keys |
| `retro_participants` | Board membership and online state | Unique `(board_id, user_id)` |
| `retro_card_votes` | Per-user card votes | Unique `(card_id, user_id)` |
| `poker_sessions` | Session settings, story, scale, and reveal state | Unique `slug`; author references `auth.users` |
| `poker_participants` | Session membership, observer flag, and online state | Unique `(session_id, user_id)` |
| `poker_votes` | Per-user estimates | Unique `(session_id, user_id)` |

## Access Helpers

- `can_access_board(uuid)` returns true for a public board, its author, or an
  existing participant.
- `can_access_poker_session(uuid)` applies the same rule to poker sessions.
- `merge_guest_account_into_current_user(source_user_id, target_user_id)`
  migrates retro and poker ownership, participation, and votes during the
  GitHub-link fallback. It is executable only by `service_role`; browser API
  roles cannot invoke it directly.

## Current RLS Summary

- Board and poker-session inserts require `author_id = auth.uid()`.
- Only the author can update or delete a board or poker session.
- Participant rows are self-managed; joining requires a public session or
  authorship.
- On unlocked retro boards, accessible participants can update or delete any
  card. Card ownership is not checked by the latest migration.
- Retro vote insert/delete requires access, an unlocked board (or board
  authorship), and `user_id = auth.uid()`.
- Poker vote insert/update requires active voting and ownership of the vote.
  Observers cannot insert. Poker vote deletion is self-only.

See `supabase/RLS_POLICIES.md` for policy names and source files.

## Realtime

`20260106120000_enable_realtime_replication.sql` sets `REPLICA IDENTITY FULL`
and adds all seven application tables to the `supabase_realtime` publication.

`20260714150754_harden_security_definer_functions.sql` pins helper search
paths, enforces service-role-only execution for account merging, and removes
duplicate participant uniqueness constraints without changing the remaining
`(board_id, user_id)` guarantee.

## Schema Changes

- Add a timestamped migration; do not edit an applied migration.
- Update `supabase/schema.sql` only when intentionally refreshing the retro
  baseline.
- Update this document and the affected feature document.
- Add new realtime tables to the publication in a new migration.
