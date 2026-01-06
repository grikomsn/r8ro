# Operations & Rebuild Playbook

Use this checklist when spinning the project up from scratch, syncing Supabase schema changes, or refreshing documentation.

## Local Environment

1. **Install dependencies**
   ```bash
   pnpm install
   ```
2. **Run dev server**
   ```bash
   pnpm dev
   ```
3. **Typecheck & build**
   ```bash
   pnpm check-types
   pnpm build
   ```
4. **Format & lint**
   ```bash
   pnpm fix
   ```
5. **Environment variables**: populate `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Supabase Introspection Workflow

1. **Connect via MCP**
   - Preferred for quick checks: run `supabase_execute_sql` queries to inspect tables, policies, or helper functions directly against project `dpdrtbkckcnedtbuwtiu`.
2. **Schema pull**
   ```bash
   supabase db pull --debug
   mv supabase/.temp/schema.sql supabase/schema.sql
   ```
3. **Generate migrations**
   ```bash
   supabase db diff -f <timestamp_description>
   ```
4. **Replay migrations locally**
   ```bash
   supabase db reset
   supabase db up
   ```
5. **Realtime replication sanity check**
   - After adding tables, re-run `supabase/migrations/20260106120000_enable_realtime_replication.sql` or craft an equivalent to set `REPLICA IDENTITY FULL` and add tables to `supabase_realtime`.

## Documentation Refresh

1. Update `docs/data-model/supabase.md` whenever schema or RLS policies change. Cite the migration filename responsible for each change.
2. Keep `docs/features/*.md` aligned with corresponding components:
   - Retro → `app/retro/[slug]/RetroPageClient.tsx`, `components/retro/*`.
   - Poker → `app/poker/[slug]/PokerSessionClient.tsx`, `components/poker/*`.
3. Regenerate diagrams or screenshots inside `docs/images/` if UI shifts materially.
4. Cross-link updates back into `README.md` so external readers know where to find details.

## From Zero to Productive

1. Clone repo + install dependencies (`pnpm install`).
2. Configure Supabase env vars and confirm anonymous auth works via `useAuth` logs.
3. Run `pnpm dev`, open `/` and `/poker` to verify landing flows.
4. Follow Supabase workflow above to ensure schema files match the remote database.
5. Walk through the feature docs under `docs/features/` to understand realtime flows before editing code.
6. When done, re-run `pnpm check-types` and `pnpm build` before committing, and document deltas here as needed.
