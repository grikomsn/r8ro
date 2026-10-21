-- Protect card identity columns from participant writes.
--
-- The retro_cards update policy checks that the caller may act on the board,
-- but it does not restrict which columns may change. A participant could
-- therefore rewrite retro_cards.author_id, which falsifies attribution and
-- changes which auth.users deletion cascades the card away, and could write
-- the votes counter directly.
--
-- The lock trigger already allows updates that leave content untouched, so
-- the simplest correct fix is a trigger that rejects changes to the identity
-- columns of a card. Content edits (content, column_type) and the
-- database-maintained votes counter stay writable.

BEGIN;

SET LOCAL lock_timeout = '3s';

CREATE OR REPLACE FUNCTION public.prevent_card_identity_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- The account merge reassigns card ownership as a service-role operation.
  -- The table owner is privileged for the same reason: it is how administrative
  -- tooling and migrations make changes.
  IF current_setting('role', true) IN ('service_role', 'none') THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.board_id IS DISTINCT FROM OLD.board_id
     OR NEW.author_id IS DISTINCT FROM OLD.author_id
     OR NEW.author_name IS DISTINCT FROM OLD.author_name THEN
    RAISE EXCEPTION 'Card identity cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  -- The vote counter is maintained by public.sync_retro_card_vote_count. A
  -- participant must not be able to write it directly, otherwise the displayed
  -- count can be forged. The counter trigger sets r8ro.vote_count_write while
  -- it performs its own bookkeeping update.
  IF current_setting('role', true) NOT IN ('service_role', 'none')
     AND coalesce(current_setting('r8ro.vote_count_write', true), '0') <> '1'
     AND NEW.votes IS DISTINCT FROM OLD.votes THEN
    RAISE EXCEPTION 'Card vote count cannot be changed directly'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.prevent_card_identity_change()
OWNER TO postgres;

REVOKE ALL ON FUNCTION public.prevent_card_identity_change()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS retro_cards_block_identity_change
ON public.retro_cards;

CREATE TRIGGER retro_cards_block_identity_change
BEFORE UPDATE ON public.retro_cards
FOR EACH ROW
EXECUTE FUNCTION public.prevent_card_identity_change();

COMMIT;
