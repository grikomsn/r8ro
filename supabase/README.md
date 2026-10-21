# Supabase Files

## Layout

- `config.toml`: local stack configuration (ports, anonymous sign-ins, redirect
  URLs).
- `migrations/20241231000000_create_retro_tables.sql`: retro tables, indexes,
  helper functions, the board-lock trigger, and baseline RLS.
- `migrations/20250101000000_create_poker_tables.sql`: poker schema and RLS.
- Later migrations: poker default state, Realtime replication, retro policy
  changes, and guest-account merging.
- `schema.sql`: static reference dump of the retro schema.
- `RLS_POLICIES.md`: concise policy reference.

For a new database, apply every file in `migrations/` in filename order. The
retro baseline is migration `20241231000000_create_retro_tables.sql`; the
migrations after it assume the retro baseline already exists.

`supabase start` and `supabase db reset --local` both apply the full
`migrations/` directory, so the local stack is reproducible from a clean
checkout. `schema.sql` is a reference dump, not a migration — do not apply it
on top of the migration history, because it creates `can_access_board` before
its tables and would fail.

## Application Tables

- `retro_boards`
- `retro_cards`
- `retro_participants`
- `retro_card_votes`
- `poker_sessions`
- `poker_participants`
- `poker_votes`

All tables have RLS enabled. Realtime configuration is defined by
`20260106120000_enable_realtime_replication.sql`.

Do not commit database connection strings, service-role keys, or a production
project reference.
