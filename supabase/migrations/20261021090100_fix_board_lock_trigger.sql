-- Fix the board lock trigger so that it blocks content changes without
-- blocking administrative operations.
--
-- Two real defects are corrected here:
--
-- 1. The trigger fired BEFORE DELETE OR UPDATE only, so its INSERT branch was
--    dead code even though the function comment claimed to cover INSERT.
--
-- 2. It rejected *every* update on a locked board, including:
--      - the guest-to-GitHub account merge, which reassigns retro_cards.author_id;
--      - ON DELETE CASCADE referential actions, which delete a user's cards
--        when their auth.users row is removed.
--    Both are ownership or bookkeeping operations rather than content edits,
--    so they must be allowed to proceed.
--
-- The author's ability to add cards and votes to their own locked board is
-- preserved, matching the existing retro_cards_insert_unlocked_or_author
-- policy.

BEGIN;

SET LOCAL lock_timeout = '3s';

CREATE OR REPLACE FUNCTION public.prevent_card_modification_if_board_locked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  locked_board record;
  caller_role text;
BEGIN
  caller_role := current_setting('role', true);

  -- Service-role callers perform account merges and cleanup. They are
  -- privileged operations rather than board content edits. The table owner
  -- (postgres) is privileged for the same reason: it is how administrative
  -- tooling and migrations make changes. A NULL role means no role was set,
  -- which is also the superuser case.
  IF caller_role IN ('service_role', 'none') OR caller_role IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Ownership-only and counter-only updates do not change card content.
    IF ROW(NEW.board_id, NEW.content, NEW.column_type)
       IS NOT DISTINCT FROM
       ROW(OLD.board_id, OLD.content, OLD.column_type) THEN
      RETURN NEW;
    END IF;

    SELECT id, author_id, is_locked
    INTO locked_board
    FROM public.retro_boards
    WHERE id = NEW.board_id
    FOR SHARE;

    IF FOUND
       AND locked_board.is_locked IS TRUE
       AND locked_board.author_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Board is locked — modifications not allowed'
        USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- Allow referential-action cascades (for example deleting auth.users).
    IF pg_trigger_depth() > 1 THEN
      RETURN OLD;
    END IF;

    SELECT id, author_id, is_locked
    INTO locked_board
    FROM public.retro_boards
    WHERE id = OLD.board_id
    FOR SHARE;

    IF FOUND
       AND locked_board.is_locked IS TRUE
       AND locked_board.author_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Board is locked — deletions not allowed'
        USING ERRCODE = '42501';
    END IF;

    RETURN OLD;
  END IF;

  -- INSERT
  SELECT id, author_id, is_locked
  INTO locked_board
  FROM public.retro_boards
  WHERE id = NEW.board_id
  FOR SHARE;

  IF FOUND
     AND locked_board.is_locked IS TRUE
     AND locked_board.author_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Board is locked — modifications not allowed'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.prevent_card_modification_if_board_locked()
OWNER TO postgres;

REVOKE ALL
ON FUNCTION public.prevent_card_modification_if_board_locked()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS retro_cards_block_when_locked
ON public.retro_cards;

CREATE TRIGGER retro_cards_block_when_locked
BEFORE INSERT OR UPDATE OR DELETE ON public.retro_cards
FOR EACH ROW
EXECUTE FUNCTION public.prevent_card_modification_if_board_locked();

COMMIT;
