-- Explicit Data API privileges for all application tables.
--
-- Supabase stops automatically granting Data API access to new tables created in
-- the "public" schema on 2026-10-30. Until now these grants came from
-- ALTER DEFAULT PRIVILEGES applied out of band, so they existed nowhere in
-- version control and were silently missing on fresh local stacks, preview
-- branches, and any new table created after that date.
--
-- Role model:
--   - Anonymous sign-in yields a JWT with role = "authenticated", so the
--     authenticated role is the one real users arrive with.
--   - The "anon" role is only used by server-side requests that carry the
--     anon key but no session (app/retro/[slug]/page.tsx and
--     app/poker/[slug]/page.tsx call generateMetadata). Those requests need
--     the privilege to exist, otherwise PostgREST answers "permission denied
--     for table" (42501) instead of an empty result.
--   - service_role is used by lib/supabase/admin.ts for the guest-to-GitHub
--     account merge and must keep full DML.
--
-- RLS remains authoritative: every policy requires a non-null auth.uid(), so
-- the anon role still reads zero rows.

BEGIN;

SET LOCAL lock_timeout = '3s';

REVOKE ALL PRIVILEGES ON TABLE
  public.retro_boards,
  public.retro_cards,
  public.retro_participants,
  public.retro_card_votes,
  public.poker_sessions,
  public.poker_participants,
  public.poker_votes
FROM PUBLIC, anon, authenticated, service_role;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- service_role bypasses RLS and performs the account merge.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.retro_boards,
  public.retro_cards,
  public.retro_participants,
  public.retro_card_votes,
  public.poker_sessions,
  public.poker_participants,
  public.poker_votes
TO service_role;

-- The authenticated role is the role anonymous visitors actually get.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.retro_boards,
  public.retro_cards,
  public.retro_participants,
  public.retro_card_votes,
  public.poker_sessions,
  public.poker_participants,
  public.poker_votes
TO authenticated;

-- The anon role only needs to be able to reach the parent tables for server
-- rendered metadata. RLS still filters every row out for it.
GRANT SELECT ON TABLE
  public.retro_boards,
  public.poker_sessions
TO anon;

COMMIT;
