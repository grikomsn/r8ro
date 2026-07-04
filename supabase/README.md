# Supabase Files

## Layout

- `schema.sql`: retro tables, indexes, helper function, and baseline RLS.
- `migrations/20250101000000_create_poker_tables.sql`: poker schema and RLS.
- Later migrations: poker default state, Realtime replication, retro policy
  changes, and guest-account merging.
- `RLS_POLICIES.md`: concise policy reference.

For a new database, apply `schema.sql`, then every migration in filename order.
The migrations assume the retro baseline already exists.

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
