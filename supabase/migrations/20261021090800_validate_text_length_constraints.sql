-- Validate the text length constraints added by
-- 20261021090500_add_text_length_constraints.sql.
--
-- The constraints were added NOT VALID so that installing them could not
-- fail on existing rows or take a long lock. This migration checks the
-- existing data and then marks the constraints as validated, so the planner
-- can rely on them.
--
-- The preflight in the previous migration already refuses to install the
-- constraints when existing rows violate them, so by the time this runs the
-- data is already known to comply. The explicit check below is kept as a
-- guard, because VALIDATE CONSTRAINT fails on a violating row and aborts the
-- whole transaction.

BEGIN;

SET LOCAL lock_timeout = '10s';

DO $$
DECLARE
  r record;
  has_violation boolean;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('retro_boards', 'slug', 80),
      ('retro_boards', 'title', 200),
      ('retro_boards', 'author_name', 80),
      ('retro_cards', 'content', 10000),
      ('retro_cards', 'author_name', 80),
      ('retro_participants', 'username', 80),
      ('poker_sessions', 'slug', 80),
      ('poker_sessions', 'title', 200),
      ('poker_sessions', 'author_name', 80),
      ('poker_sessions', 'current_story', 10000),
      ('poker_participants', 'username', 80),
      ('poker_votes', 'vote_value', 32)
    ) AS limits(table_name, column_name, max_chars)
  LOOP
    EXECUTE format(
      'SELECT EXISTS (
         SELECT 1 FROM public.%I WHERE char_length(%I) > %s
       )',
      r.table_name,
      r.column_name,
      r.max_chars
    ) INTO has_violation;

    IF has_violation THEN
      RAISE EXCEPTION
        'Existing %.% exceeds % characters; export and resolve before validating',
        r.table_name,
        r.column_name,
        r.max_chars;
    END IF;
  END LOOP;
END;
$$;

ALTER TABLE public.retro_boards
  VALIDATE CONSTRAINT retro_boards_slug_length,
  VALIDATE CONSTRAINT retro_boards_title_length,
  VALIDATE CONSTRAINT retro_boards_author_name_length;

ALTER TABLE public.retro_cards
  VALIDATE CONSTRAINT retro_cards_content_length,
  VALIDATE CONSTRAINT retro_cards_author_name_length;

ALTER TABLE public.retro_participants
  VALIDATE CONSTRAINT retro_participants_username_length;

ALTER TABLE public.poker_sessions
  VALIDATE CONSTRAINT poker_sessions_slug_length,
  VALIDATE CONSTRAINT poker_sessions_title_length,
  VALIDATE CONSTRAINT poker_sessions_author_name_length,
  VALIDATE CONSTRAINT poker_sessions_current_story_length;

ALTER TABLE public.poker_participants
  VALIDATE CONSTRAINT poker_participants_username_length;

ALTER TABLE public.poker_votes
  VALIDATE CONSTRAINT poker_votes_vote_value_length;

COMMIT;
