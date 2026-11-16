-- Keep a history of estimated stories in a poker session.
--
-- A session used to hold only the current story and its votes, so every
-- estimate was lost as soon as the facilitator cleared the votes for the next
-- story. poker_rounds records each finished round: the story, the agreed
-- estimate and a snapshot of the votes.
--
-- complete_poker_round() is the facilitator's "next round" action. It records
-- the round, clears the votes and opens voting on the next story in one
-- transaction, so participants never see a half finished transition.

BEGIN;

SET LOCAL lock_timeout = '3s';

CREATE TABLE IF NOT EXISTS public.poker_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL
    REFERENCES public.poker_sessions(id) ON DELETE CASCADE,
  story text,
  estimate text,
  votes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT poker_rounds_story_length CHECK (
    story IS NULL OR char_length(story) <= 10000
  ),
  CONSTRAINT poker_rounds_estimate_length CHECK (
    estimate IS NULL OR char_length(estimate) <= 32
  ),
  CONSTRAINT poker_rounds_votes_is_array CHECK (
    jsonb_typeof(votes) = 'array'
  )
);

CREATE INDEX IF NOT EXISTS poker_rounds_session_created_idx
  ON public.poker_rounds (session_id, created_at);

ALTER TABLE public.poker_rounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS poker_rounds_select_policy ON public.poker_rounds;

CREATE POLICY poker_rounds_select_policy
ON public.poker_rounds
FOR SELECT
TO authenticated
USING (public.can_access_poker_session(session_id));

-- Rounds are written by complete_poker_round(). The author may remove one.
DROP POLICY IF EXISTS poker_rounds_delete_policy ON public.poker_rounds;

CREATE POLICY poker_rounds_delete_policy
ON public.poker_rounds
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.poker_sessions s
    WHERE s.id = poker_rounds.session_id
      AND s.author_id = (SELECT auth.uid())
  )
);

REVOKE ALL PRIVILEGES ON TABLE public.poker_rounds
FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, DELETE ON TABLE public.poker_rounds TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.poker_rounds
TO service_role;

ALTER TABLE public.poker_rounds REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'poker_rounds'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.poker_rounds;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.complete_poker_round(
  p_session_id uuid,
  p_estimate text,
  p_next_story text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  session_row public.poker_sessions%ROWTYPE;
  round_id uuid;
  estimate_value text := NULLIF(btrim(p_estimate), '');
  next_story text := NULLIF(btrim(p_next_story), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO session_row
  FROM public.poker_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND OR session_row.author_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the session author may complete a round'
      USING ERRCODE = '42501';
  END IF;

  IF estimate_value IS NOT NULL AND char_length(estimate_value) > 32 THEN
    RAISE EXCEPTION 'Estimate is too long'
      USING ERRCODE = '22001';
  END IF;

  IF next_story IS NOT NULL AND char_length(next_story) > 10000 THEN
    RAISE EXCEPTION 'Story is too long'
      USING ERRCODE = '22001';
  END IF;

  INSERT INTO public.poker_rounds (session_id, story, estimate, votes)
  SELECT
    p_session_id,
    session_row.current_story,
    estimate_value,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'username', COALESCE(p.username, 'Unknown'),
          'value', v.vote_value
        )
        ORDER BY v.created_at
      ) FILTER (WHERE v.id IS NOT NULL),
      '[]'::jsonb
    )
  FROM (SELECT 1) AS one
  LEFT JOIN public.poker_votes v
    ON v.session_id = p_session_id
  LEFT JOIN public.poker_participants p
    ON p.session_id = v.session_id
   AND p.user_id = v.user_id
  RETURNING id INTO round_id;

  DELETE FROM public.poker_votes
  WHERE session_id = p_session_id;

  UPDATE public.poker_sessions
  SET
    current_story = next_story,
    votes_revealed = false,
    is_voting_active = true,
    updated_at = now()
  WHERE id = p_session_id;

  RETURN round_id;
END;
$$;

ALTER FUNCTION public.complete_poker_round(uuid, text, text)
OWNER TO postgres;

REVOKE ALL ON FUNCTION public.complete_poker_round(uuid, text, text)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.complete_poker_round(uuid, text, text)
TO authenticated;

COMMIT;
