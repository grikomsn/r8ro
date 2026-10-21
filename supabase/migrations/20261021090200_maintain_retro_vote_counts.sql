-- Make retro_cards.votes authoritative in the database.
--
-- The counter column was never written by the database. The client incremented
-- it locally from realtime events, which drifted permanently whenever an event
-- was missed. Two concrete defects made that worse:
--
--   - With RLS enabled, realtime DELETE payloads contain only the primary key
--     even under REPLICA IDENTITY FULL, so the client could not identify which
--     card lost a vote and never decremented.
--   - The counter could be forged by any participant, because the card UPDATE
--     policy did not restrict which columns could change.
--
-- This migration keeps the counter correct with an atomic AFTER trigger on
-- retro_card_votes and backfills existing rows.
--
-- The client is updated separately to trust the stored value instead of doing
-- local arithmetic.

BEGIN;

SET LOCAL lock_timeout = '3s';

LOCK TABLE public.retro_cards, public.retro_card_votes
IN SHARE ROW EXCLUSIVE MODE;

CREATE OR REPLACE FUNCTION public.sync_retro_card_vote_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  old_card_id uuid;
  new_card_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    old_card_id := OLD.card_id;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    new_card_id := NEW.card_id;
  END IF;

  -- A vote that stays on the same card does not change any count.
  IF TG_OP = 'UPDATE'
     AND old_card_id IS NOT DISTINCT FROM new_card_id THEN
    RETURN NULL;
  END IF;

  -- Serialize concurrent votes on the same card so the increment is atomic.
  PERFORM id
  FROM public.retro_cards
  WHERE id = old_card_id OR id = new_card_id
  ORDER BY id
  FOR NO KEY UPDATE;

  -- The counter guard in public.prevent_card_identity_change refuses direct
  -- writes to retro_cards.votes. This flag marks the update below as the
  -- trigger's own bookkeeping.
  PERFORM set_config('r8ro.vote_count_write', '1', true);

  IF old_card_id IS NOT NULL THEN
    UPDATE public.retro_cards
    SET votes = votes - 1
    WHERE id = old_card_id
      AND votes > 0;
  END IF;

  IF new_card_id IS NOT NULL THEN
    UPDATE public.retro_cards
    SET votes = votes + 1
    WHERE id = new_card_id;
  END IF;

  PERFORM set_config('r8ro.vote_count_write', '0', true);

  RETURN NULL;
END;
$$;

ALTER FUNCTION public.sync_retro_card_vote_count()
OWNER TO postgres;

REVOKE ALL ON FUNCTION public.sync_retro_card_vote_count()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS retro_card_votes_sync_count
ON public.retro_card_votes;

CREATE TRIGGER retro_card_votes_sync_count
AFTER INSERT OR DELETE OR UPDATE OF card_id
ON public.retro_card_votes
FOR EACH ROW
EXECUTE FUNCTION public.sync_retro_card_vote_count();

-- Repair the counter for every existing card, including zero-vote cards.
UPDATE public.retro_cards c
SET votes = (
  SELECT count(*)::integer
  FROM public.retro_card_votes v
  WHERE v.card_id = c.id
);

ALTER TABLE public.retro_cards
  ALTER COLUMN votes SET DEFAULT 0;

ALTER TABLE public.retro_cards
  ALTER COLUMN votes SET NOT NULL;

ALTER TABLE public.retro_cards
  DROP CONSTRAINT IF EXISTS retro_cards_votes_nonnegative;

ALTER TABLE public.retro_cards
  ADD CONSTRAINT retro_cards_votes_nonnegative CHECK (votes >= 0);

COMMIT;
