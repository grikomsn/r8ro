-- Show who has voted before the votes are revealed.
--
-- poker_votes_select_policy hides other participants' votes until the session
-- is revealed, which also hid whether they had voted at all. The facilitator
-- could not tell when everyone was done. poker_participants.has_voted exposes
-- that single bit (never the value) and is maintained by the database:
--
-- * a trigger on poker_votes recomputes it whenever a vote row appears,
--   disappears or moves, so clear_poker_votes and the guest merge keep it in
--   step as well;
-- * a trigger on poker_participants ignores a client that tries to set it
--   directly, because the update policy lets a user update their own row.
--
-- poker_participants is already in the realtime publication, so every client
-- receives the change.

BEGIN;

SET LOCAL lock_timeout = '3s';

ALTER TABLE public.poker_participants
  ADD COLUMN IF NOT EXISTS has_voted boolean NOT NULL DEFAULT false;

UPDATE public.poker_participants p
SET has_voted = EXISTS (
  SELECT 1
  FROM public.poker_votes v
  WHERE v.session_id = p.session_id
    AND v.user_id = p.user_id
);

CREATE OR REPLACE FUNCTION public.sync_poker_participant_has_voted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP IN ('DELETE', 'UPDATE') THEN
    UPDATE public.poker_participants p
    SET has_voted = EXISTS (
      SELECT 1
      FROM public.poker_votes v
      WHERE v.session_id = OLD.session_id
        AND v.user_id = OLD.user_id
    )
    WHERE p.session_id = OLD.session_id
      AND p.user_id = OLD.user_id;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    UPDATE public.poker_participants p
    SET has_voted = true
    WHERE p.session_id = NEW.session_id
      AND p.user_id = NEW.user_id
      AND p.has_voted IS DISTINCT FROM true;
  END IF;

  RETURN NULL;
END;
$$;

ALTER FUNCTION public.sync_poker_participant_has_voted()
OWNER TO postgres;

REVOKE ALL ON FUNCTION public.sync_poker_participant_has_voted()
FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS poker_votes_sync_has_voted ON public.poker_votes;

CREATE TRIGGER poker_votes_sync_has_voted
AFTER INSERT OR DELETE OR UPDATE OF session_id, user_id
ON public.poker_votes
FOR EACH ROW
EXECUTE FUNCTION public.sync_poker_participant_has_voted();

-- A direct write (trigger depth 1) cannot choose the value. Writes made by
-- sync_poker_participant_has_voted run at depth 2 and are kept.
CREATE OR REPLACE FUNCTION public.protect_poker_participant_has_voted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.has_voted := OLD.has_voted;
  ELSE
    NEW.has_voted := EXISTS (
      SELECT 1
      FROM public.poker_votes v
      WHERE v.session_id = NEW.session_id
        AND v.user_id = NEW.user_id
    );
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.protect_poker_participant_has_voted()
OWNER TO postgres;

REVOKE ALL ON FUNCTION public.protect_poker_participant_has_voted()
FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS poker_participants_protect_has_voted
ON public.poker_participants;

CREATE TRIGGER poker_participants_protect_has_voted
BEFORE INSERT OR UPDATE
ON public.poker_participants
FOR EACH ROW
EXECUTE FUNCTION public.protect_poker_participant_has_voted();

COMMIT;
