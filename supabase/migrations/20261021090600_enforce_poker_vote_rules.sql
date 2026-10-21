-- Enforce the poker voting rules at the database boundary.
--
-- Two gaps existed:
--
-- 1. poker_votes_select_policy only checked can_access_poker_session, so any
--    participant could read every other participant's estimate through the
--    API even while the session was not revealed. The reveal mechanic was
--    cosmetic. The policy now hides other users' votes until the session is
--    revealed, while always letting a user see their own vote.
--
-- 2. The insert and update policies did not check that a vote value belongs
--    to the session's voting scale, and the update policy did not exclude
--    observers, so a participant could cast or change a vote to a value that
--    was not on the scale, or change a vote after becoming an observer.
--
-- The app must refetch votes when the reveal state changes; see the client
-- changes that accompany this migration.

BEGIN;

SET LOCAL lock_timeout = '3s';

DROP POLICY IF EXISTS poker_votes_select_policy ON public.poker_votes;

CREATE POLICY poker_votes_select_policy
ON public.poker_votes
FOR SELECT
TO public
USING (
  (SELECT auth.uid()) IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.poker_sessions s
    WHERE s.id = poker_votes.session_id
      AND (
        s.votes_revealed IS TRUE
        OR poker_votes.user_id = (SELECT auth.uid())
      )
  )
);

DROP POLICY IF EXISTS poker_votes_insert_policy ON public.poker_votes;

CREATE POLICY poker_votes_insert_policy
ON public.poker_votes
FOR INSERT
TO public
WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL
  AND user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.poker_sessions s
    WHERE s.id = poker_votes.session_id
      AND s.is_voting_active IS TRUE
      AND poker_votes.vote_value = ANY(s.voting_scale)
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.poker_participants p
    WHERE p.session_id = poker_votes.session_id
      AND p.user_id = (SELECT auth.uid())
      AND p.is_observer IS TRUE
  )
);

DROP POLICY IF EXISTS poker_votes_update_policy ON public.poker_votes;

CREATE POLICY poker_votes_update_policy
ON public.poker_votes
FOR UPDATE
TO public
USING (
  (SELECT auth.uid()) IS NOT NULL
  AND user_id = (SELECT auth.uid())
)
WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL
  AND user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.poker_sessions s
    WHERE s.id = poker_votes.session_id
      AND s.is_voting_active IS TRUE
      AND poker_votes.vote_value = ANY(s.voting_scale)
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.poker_participants p
    WHERE p.session_id = poker_votes.session_id
      AND p.user_id = (SELECT auth.uid())
      AND p.is_observer IS TRUE
  )
);

COMMIT;
