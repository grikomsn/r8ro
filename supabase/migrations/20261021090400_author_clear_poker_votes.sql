-- Let the session author clear every vote in their own poker session.
--
-- The client deleted votes with .eq("session_id", id), but
-- poker_votes_delete_policy only permits a user to delete their own vote:
--
--   USING ((SELECT auth.uid()) = user_id)
--
-- PostgREST therefore deleted only the author's own row and returned HTTP 200
-- with an empty body, so the app saw success while every other participant's
-- vote stayed in the database. The facilitator loop (vote, reveal, clear, next
-- round) could not be completed.
--
-- This function performs the author-scoped delete under SECURITY DEFINER, so
-- it is not subject to the per-row delete policy. The author check is made
-- explicit against poker_sessions.author_id.

BEGIN;

SET LOCAL lock_timeout = '3s';

CREATE OR REPLACE FUNCTION public.clear_poker_votes(p_session_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  owner_id uuid;
  deleted_count bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  SELECT author_id
  INTO owner_id
  FROM public.poker_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND OR owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the session author may clear votes'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.poker_votes
  WHERE session_id = p_session_id;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

ALTER FUNCTION public.clear_poker_votes(uuid)
OWNER TO postgres;

REVOKE ALL ON FUNCTION public.clear_poker_votes(uuid)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.clear_poker_votes(uuid)
TO authenticated;

COMMIT;
