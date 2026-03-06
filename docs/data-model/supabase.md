# Supabase Data Model & Policies

This document mirrors the current schema living under `supabase/` and explains how to regenerate or audit it. Treat it as the single source of truth for relational structures, helper functions, and Row Level Security (RLS) behavior.

## Tables & Columns

### Retro Boards

| Table | Key Columns | Notes |
| --- | --- | --- |
| `retro_boards` | `id`, `slug`, `title`, `author_id`, `author_name`, `is_public`, `is_locked`, `timer_running`, `timer_seconds`, `timer_started_at` | Session metadata plus lock + timer state. Created via `app/new/route.ts` and manipulated inside `app/retro/[slug]/RetroPageClient.tsx`. |
| `retro_cards` | `id`, `board_id`, `column_type`, `content`, `author_id`, `author_name`, `created_at`, `updated_at` | Cards live inside one of three column types. Realtime updates flow to `components/retro/retro-column.tsx`. |
| `retro_participants` | `id`, `board_id`, `user_id`, `username`, `is_online`, `joined_at` | Tracks presence and gating for private boards. `useAuth` upserts the viewer on load. |
| `retro_card_votes` | `id`, `card_id`, `user_id`, `created_at` | Stores per-user votes with a unique constraint on `(card_id, user_id)` for toggle behavior. |

### Poker Sessions

Defined initially by `supabase/migrations/20250101000000_create_poker_tables.sql` with later tweaks (e.g., default `is_voting_active = true` in `20251223151027_alter_poker_sessions_default_voting_active.sql`).

| Table | Key Columns | Notes |
| --- | --- | --- |
| `poker_sessions` | `id`, `slug`, `title`, `author_id`, `author_name`, `voting_scale` (text[]), `current_story`, `votes_revealed`, `is_voting_active`, `is_public`, timestamps | Mirrors retro boards but adds voting controls and current story tracking. |
| `poker_participants` | `id`, `session_id`, `user_id`, `username`, `is_online`, `is_observer`, `joined_at` | Observers skip voting privileges; enforced in RLS. |
| `poker_votes` | `id`, `session_id`, `user_id`, `vote_value`, `created_at` | Unique `(session_id, user_id)` constraint prevents multiple votes. |

### Helper Functions

- `can_access_board(board_uuid uuid)` (in `supabase/schema.sql`): SECURITY DEFINER shortcut to grant participant visibility without RLS recursion.
- `can_access_poker_session(session_uuid uuid)` (created in `20250101000000_create_poker_tables.sql`): Mirrors the board helper but considers observer/author/public rules.
- `merge_guest_account_into_current_user(source_user_id uuid, target_user_id uuid)` (created in `20260307113000_add_guest_account_merge_function.sql`): server-only merge helper used by auth callback fallback when GitHub identity is already linked elsewhere. It migrates retro + poker ownership/participation/votes and resolves poker vote conflicts by keeping the most recent `created_at`.

The access helpers rely on `(SELECT auth.uid())` so RLS policies can check visibility with a single UID evaluation.

## Row Level Security Summary

### Retro Policies (see `supabase/RLS_POLICIES.md` + migration `20260106123000_update_retro_policies.sql`)

- **Boards (`retro_boards`)**: public SELECT, author-only UPDATE/DELETE, authenticated INSERT.
- **Cards (`retro_cards`)**: participants may insert/update/delete while board unlocked; authors override lock. Policies were replaced in `20260106123000_update_retro_policies.sql` to grant unlocked participants more control.
- **Participants (`retro_participants`)**: join/leave/update only self; SELECT guarded by `can_access_board`.
- **Votes (`retro_card_votes`)**: insert/delete only when board unlocked or viewer is author.

### Poker Policies (see `20250101000000_create_poker_tables.sql`)

- **Sessions**: SELECT if public, author, or participant; author-only UPDATE/DELETE; authenticated INSERT.
- **Participants**: can join public sessions or ones they created; updates/deletes scoped to own row.
- **Votes**: insert/update allowed only when `is_voting_active` and viewer is not an observer; deletes limited to self.

### Realtime Publication

Migration `20260106120000_enable_realtime_replication.sql` sets `REPLICA IDENTITY FULL` on all retro + poker tables and ensures they belong to the `supabase_realtime` publication. To keep realtime streams stable, rerun that migration (or craft an equivalent) whenever introducing new replicated tables.

## Regenerating the Schema Dump

1. **Connect to Supabase MCP** (preferred): `supabase_execute_sql` queries run against project `dpdrtbkckcnedtbuwtiu`. Use it to confirm table signatures or policy text before editing docs.
2. **CLI Pull** (fallback):
   ```bash
   supabase db pull --debug
   mv supabase/.temp/schema.sql supabase/schema.sql
   ```
3. **Diff & migrate**: generate new migrations with `supabase db diff -f <name>` whenever schema changes occur locally.
4. **Update docs**: once the schema dump changes, revisit this file plus `docs/features/*.md` to keep descriptions aligned with actual columns/policies.

## Troubleshooting Checklist

- Missing realtime events → confirm table appears in `pg_publication_tables` for `supabase_realtime` (see migration above).
- Access denied errors → inspect helper functions to ensure `SECURITY DEFINER` owner still exists; redeploy function if Supabase resets roles.
- Stale policy behavior → read the latest migration touching that table to ensure docs reference current logic.
