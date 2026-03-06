-- Merge guest account data into a target account after GitHub relink fallback.
CREATE OR REPLACE FUNCTION public.merge_guest_account_into_current_user(
  source_user_id uuid,
  target_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  source_is_anonymous boolean;
BEGIN
  IF source_user_id IS NULL THEN
    RAISE EXCEPTION 'source_user_id is required';
  END IF;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id is required';
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
    SELECT 1
    FROM auth.users
    WHERE id = target_user_id
  ) THEN
    RAISE EXCEPTION 'target_user_id does not exist';
  END IF;

  UPDATE public.retro_boards
  SET author_id = target_user_id
  WHERE author_id = source_user_id;

  UPDATE public.retro_cards
  SET author_id = target_user_id
  WHERE author_id = source_user_id;

  INSERT INTO public.retro_participants (board_id, user_id, username, is_online, joined_at)
  SELECT
    board_id,
    target_user_id,
    username,
    is_online,
    joined_at
  FROM public.retro_participants
  WHERE user_id = source_user_id
  ON CONFLICT (board_id, user_id) DO UPDATE
  SET
    username = CASE
      WHEN public.retro_participants.joined_at <= EXCLUDED.joined_at
        THEN public.retro_participants.username
      ELSE EXCLUDED.username
    END,
    is_online = public.retro_participants.is_online OR EXCLUDED.is_online,
    joined_at = LEAST(public.retro_participants.joined_at, EXCLUDED.joined_at);

  DELETE FROM public.retro_participants
  WHERE user_id = source_user_id;

  INSERT INTO public.retro_card_votes (card_id, user_id, created_at)
  SELECT
    card_id,
    target_user_id,
    created_at
  FROM public.retro_card_votes
  WHERE user_id = source_user_id
  ON CONFLICT (card_id, user_id) DO NOTHING;

  DELETE FROM public.retro_card_votes
  WHERE user_id = source_user_id;

  UPDATE public.poker_sessions
  SET author_id = target_user_id
  WHERE author_id = source_user_id;

  INSERT INTO public.poker_participants (
    session_id,
    user_id,
    username,
    is_online,
    is_observer,
    joined_at
  )
  SELECT
    session_id,
    target_user_id,
    username,
    is_online,
    is_observer,
    joined_at
  FROM public.poker_participants
  WHERE user_id = source_user_id
  ON CONFLICT (session_id, user_id) DO UPDATE
  SET
    username = CASE
      WHEN public.poker_participants.joined_at <= EXCLUDED.joined_at
        THEN public.poker_participants.username
      ELSE EXCLUDED.username
    END,
    is_online = public.poker_participants.is_online OR EXCLUDED.is_online,
    is_observer = public.poker_participants.is_observer
      AND EXCLUDED.is_observer,
    joined_at = LEAST(public.poker_participants.joined_at, EXCLUDED.joined_at);

  DELETE FROM public.poker_participants
  WHERE user_id = source_user_id;

  INSERT INTO public.poker_votes (session_id, user_id, vote_value, created_at)
  SELECT
    session_id,
    target_user_id,
    vote_value,
    created_at
  FROM public.poker_votes
  WHERE user_id = source_user_id
  ON CONFLICT (session_id, user_id) DO UPDATE
  SET
    vote_value = EXCLUDED.vote_value,
    created_at = EXCLUDED.created_at
  WHERE EXCLUDED.created_at >= public.poker_votes.created_at;

  DELETE FROM public.poker_votes
  WHERE user_id = source_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_guest_account_into_current_user(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_guest_account_into_current_user(uuid, uuid) TO service_role;
