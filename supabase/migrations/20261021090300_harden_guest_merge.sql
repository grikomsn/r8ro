-- Harden the guest account merge and make its transfers lossless.
--
-- Two defects are corrected here.
--
-- 1. The function body never checked who was calling it. It was protected only
--    by its GRANTs, so any future privilege mistake would have been directly
--    exploitable: a caller could pass an arbitrary anonymous source_user_id and
--    an arbitrary target_user_id and claim another user's boards. The function
--    now verifies the request role.
--
-- 2. Each transfer copied rows with one statement and then deleted the source
--    rows with a separate statement. Those two statements see different
--    snapshots, so a vote written by an old guest tab between them was deleted
--    without ever being transferred. Each transfer now consumes exactly the rows
--    it moves.
--
-- Note that auth.uid() is NULL for the service-role client used by
-- app/auth/callback/route.ts, so the caller identity is taken from the request
-- role rather than from auth.uid().

BEGIN;

SET LOCAL lock_timeout = '3s';

CREATE OR REPLACE FUNCTION public.merge_guest_account_into_current_user(
  source_user_id uuid,
  target_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  source_is_anonymous boolean;
BEGIN
  IF source_user_id IS NULL OR target_user_id IS NULL THEN
    RAISE EXCEPTION 'source_user_id and target_user_id are required'
      USING ERRCODE = '22004';
  END IF;

  -- Only the server side service-role client may perform a transfer. The
  -- table owner is also permitted so that administrative tooling can still
  -- repair ownership by hand.
  IF current_setting('role', true) NOT IN ('service_role', 'none') THEN
    RAISE EXCEPTION 'Account transfers require service_role'
      USING ERRCODE = '42501';
  END IF;

  IF source_user_id = target_user_id THEN
    RETURN;
  END IF;

  SELECT users.is_anonymous
  INTO source_is_anonymous
  FROM auth.users
  WHERE users.id = source_user_id;

  IF source_is_anonymous IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'source_user_id must belong to an anonymous user';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = target_user_id
  ) THEN
    RAISE EXCEPTION 'target_user_id does not exist';
  END IF;

  UPDATE public.retro_boards
  SET author_id = target_user_id
  WHERE author_id = source_user_id;

  UPDATE public.retro_cards
  SET author_id = target_user_id
  WHERE author_id = source_user_id;

  -- Consume exactly the participant rows that are moved, so a row written
  -- concurrently is never deleted without being transferred.
  WITH moved AS (
    DELETE FROM public.retro_participants
    WHERE user_id = source_user_id
    RETURNING board_id, username, is_online, joined_at
  )
  INSERT INTO public.retro_participants
    (board_id, user_id, username, is_online, joined_at)
  SELECT
    board_id,
    target_user_id,
    username,
    is_online,
    joined_at
  FROM moved
  ON CONFLICT (board_id, user_id) DO UPDATE
  SET
    username = CASE
      WHEN public.retro_participants.joined_at <= EXCLUDED.joined_at
        THEN public.retro_participants.username
      ELSE EXCLUDED.username
    END,
    is_online = public.retro_participants.is_online OR EXCLUDED.is_online,
    joined_at = LEAST(
      public.retro_participants.joined_at,
      EXCLUDED.joined_at
    );

  WITH moved AS (
    DELETE FROM public.retro_card_votes
    WHERE user_id = source_user_id
    RETURNING card_id, created_at
  )
  INSERT INTO public.retro_card_votes (card_id, user_id, created_at)
  SELECT card_id, target_user_id, created_at
  FROM moved
  ON CONFLICT (card_id, user_id) DO NOTHING;

  UPDATE public.poker_sessions
  SET author_id = target_user_id
  WHERE author_id = source_user_id;

  WITH moved AS (
    DELETE FROM public.poker_participants
    WHERE user_id = source_user_id
    RETURNING session_id, username, is_online, is_observer, joined_at
  )
  INSERT INTO public.poker_participants
    (session_id, user_id, username, is_online, is_observer, joined_at)
  SELECT
    session_id,
    target_user_id,
    username,
    is_online,
    is_observer,
    joined_at
  FROM moved
  ON CONFLICT (session_id, user_id) DO UPDATE
  SET
    username = CASE
      WHEN public.poker_participants.joined_at <= EXCLUDED.joined_at
        THEN public.poker_participants.username
      ELSE EXCLUDED.username
    END,
    is_online = public.poker_participants.is_online OR EXCLUDED.is_online,
    is_observer =
      public.poker_participants.is_observer AND EXCLUDED.is_observer,
    joined_at = LEAST(
      public.poker_participants.joined_at,
      EXCLUDED.joined_at
    );

  WITH moved AS (
    DELETE FROM public.poker_votes
    WHERE user_id = source_user_id
    RETURNING session_id, vote_value, created_at
  )
  INSERT INTO public.poker_votes (session_id, user_id, vote_value, created_at)
  SELECT session_id, target_user_id, vote_value, created_at
  FROM moved
  ON CONFLICT (session_id, user_id) DO UPDATE
  SET
    vote_value = EXCLUDED.vote_value,
    created_at = EXCLUDED.created_at
  WHERE EXCLUDED.created_at >= public.poker_votes.created_at;
END;
$$;

ALTER FUNCTION public.merge_guest_account_into_current_user(uuid, uuid)
OWNER TO postgres;

REVOKE ALL
ON FUNCTION public.merge_guest_account_into_current_user(uuid, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.merge_guest_account_into_current_user(uuid, uuid)
TO service_role;

COMMIT;
