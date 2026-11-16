# Supabase Data Model

The database definition is split across:

1. `supabase/migrations/20241231000000_create_retro_tables.sql`, the retro
   baseline.
2. `supabase/migrations/*.sql`, applied in filename order.

`supabase/schema.sql` is a static reference dump of the retro schema, not a
migration. Do not apply it on top of the migration history.

SQL files are authoritative when this document differs.

## Grants

Every migration that creates a table states its grants explicitly. The
`20261021090000_grant_table_privileges.sql` migration gives the
`authenticated` role full DML on the seven application tables, `service_role`
the same, and the `anon` role `SELECT` on the parent tables only, because the
server-rendered metadata queries run without a session.

Supabase stops automatically granting Data API access to new tables in the
`public` schema on 2026-10-30, so a new table needs its own grants in the same
migration that creates it.

## Tables

| Table | Purpose | Important constraints |
| --- | --- | --- |
| `retro_boards` | Board settings and timer state (`timer_seconds` is the duration, `timer_remaining_seconds` what was left when paused) | Unique `slug`; author references `auth.users` |
| `retro_cards` | Cards in one of three columns | Board and author foreign keys |
| `retro_participants` | Board membership and online state | Unique `(board_id, user_id)` |
| `retro_card_votes` | Per-user card votes | Unique `(card_id, user_id)` |
| `poker_sessions` | Session settings, story, scale, and reveal state | Unique `slug`; author references `auth.users` |
| `poker_participants` | Session membership, observer flag, online state, and `has_voted` | Unique `(session_id, user_id)` |
| `poker_votes` | Per-user estimates | Unique `(session_id, user_id)` |
| `poker_rounds` | Finished stories: story, agreed estimate, and a votes snapshot | Session foreign key with cascade delete |

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
- Poker vote insert/update requires active voting, ownership of the vote, and a
  value that is on the session's voting scale. Observers cannot insert or
  update. Poker vote deletion is self-only.
- Poker votes are only readable by other participants once the session is
  revealed. A participant always sees their own vote.
- `clear_poker_votes(session_id)` removes every vote in a session. It is
  restricted to the session author.
- `complete_poker_round(session_id, estimate, next_story)` records the current
  story with its votes in `poker_rounds`, clears the votes, and opens voting on
  the next story in one transaction. It is restricted to the session author.
- `poker_participants.has_voted` is maintained by triggers on `poker_votes`,
  so everyone can see who has voted before the reveal without seeing values.
  A client write to it is ignored.
- `poker_rounds` is readable by anyone with access to the session. Rows are
  created only through `complete_poker_round`; the author can delete one.
- `retro_cards.votes` is maintained by the database and is the authoritative
  count. A participant cannot write it directly.

See `supabase/RLS_POLICIES.md` for policy names and source files.

## Realtime

`20260106120000_enable_realtime_replication.sql` sets `REPLICA IDENTITY FULL`
and adds all seven original application tables to the `supabase_realtime`
publication. `20261116120200_poker_rounds.sql` adds `poker_rounds` the same
way.

`20260714150754_harden_security_definer_functions.sql` pins helper search
paths, enforces service-role-only execution for account merging, and removes
duplicate participant uniqueness constraints without changing the remaining
`(board_id, user_id)` guarantee.

## Schema Changes

- Add a timestamped migration; do not edit an applied migration.
- Update `supabase/schema.sql` only when intentionally refreshing the retro
  reference dump, and keep it in sync with the retro baseline migration.
- Update this document and the affected feature document.
- Add new realtime tables to the publication in a new migration.
