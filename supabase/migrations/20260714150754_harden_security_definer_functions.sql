-- Keep RLS helper resolution deterministic while retaining the grants required
-- for authenticated, anonymous-first sessions.
ALTER FUNCTION public.can_access_board(uuid)
SET search_path = pg_catalog, public;

ALTER FUNCTION public.can_access_poker_session(uuid)
SET search_path = pg_catalog, public;

-- This RPC is invoked only by the server-side service-role client. Supabase
-- grants new public functions to API roles by default, so revoke those roles
-- explicitly in addition to PUBLIC.
ALTER FUNCTION public.merge_guest_account_into_current_user(uuid, uuid)
SET search_path = pg_catalog, public, auth;

REVOKE ALL ON FUNCTION public.merge_guest_account_into_current_user(uuid, uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_guest_account_into_current_user(uuid, uuid)
TO service_role;

-- Trigger functions do not need direct Data API execution privileges.
REVOKE ALL ON FUNCTION public.prevent_card_modification_if_board_locked()
FROM PUBLIC, anon, authenticated;

-- Retain the named baseline constraint and remove redundant unique indexes.
ALTER TABLE public.retro_participants
DROP CONSTRAINT IF EXISTS retro_participants_board_id_user_id_key;

ALTER TABLE public.retro_participants
DROP CONSTRAINT IF EXISTS unique_board_user;
