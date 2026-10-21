-- Bound every user-writable text column.
--
-- There were no length constraints anywhere: no char_length CHECK constraints
-- and no maxLength attributes in the UI. Any anonymous visitor could insert
-- arbitrarily large titles, card contents, stories and usernames.
--
-- The constraints are added NOT VALID so that existing rows are not scanned or
-- locked during the change, and so that no existing content is silently
-- truncated. A separate migration validates them once the data is known to
-- comply.
--
-- Lengths are chosen to be generous for real use while still bounding a row.

BEGIN;

SET LOCAL lock_timeout = '3s';

-- Refuse to install the constraints if existing data already violates them.
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
        'Existing %.% exceeds % characters; export and resolve before applying',
        r.table_name,
        r.column_name,
        r.max_chars;
    END IF;
  END LOOP;
END;
$$;

ALTER TABLE public.retro_boards
  ADD CONSTRAINT retro_boards_slug_length
    CHECK (char_length(slug) <= 80) NOT VALID,
  ADD CONSTRAINT retro_boards_title_length
    CHECK (char_length(title) <= 200) NOT VALID,
  ADD CONSTRAINT retro_boards_author_name_length
    CHECK (char_length(author_name) <= 80) NOT VALID;

ALTER TABLE public.retro_cards
  ADD CONSTRAINT retro_cards_content_length
    CHECK (char_length(content) <= 10000) NOT VALID,
  ADD CONSTRAINT retro_cards_author_name_length
    CHECK (char_length(author_name) <= 80) NOT VALID;

ALTER TABLE public.retro_participants
  ADD CONSTRAINT retro_participants_username_length
    CHECK (char_length(username) <= 80) NOT VALID;

ALTER TABLE public.poker_sessions
  ADD CONSTRAINT poker_sessions_slug_length
    CHECK (char_length(slug) <= 80) NOT VALID,
  ADD CONSTRAINT poker_sessions_title_length
    CHECK (char_length(title) <= 200) NOT VALID,
  ADD CONSTRAINT poker_sessions_author_name_length
    CHECK (char_length(author_name) <= 80) NOT VALID,
  ADD CONSTRAINT poker_sessions_current_story_length
    CHECK (char_length(current_story) <= 10000) NOT VALID;

ALTER TABLE public.poker_participants
  ADD CONSTRAINT poker_participants_username_length
    CHECK (char_length(username) <= 80) NOT VALID;

ALTER TABLE public.poker_votes
  ADD CONSTRAINT poker_votes_vote_value_length
    CHECK (char_length(vote_value) <= 32) NOT VALID;

COMMIT;
