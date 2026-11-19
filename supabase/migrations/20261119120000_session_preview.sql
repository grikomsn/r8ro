-- Link previews for retro boards and poker sessions.
--
-- A link pasted into Slack, Teams or a browser tab is fetched without a
-- session, so the select policies (which require auth.uid()) return nothing
-- and every preview fell back to the slug. This function returns a small,
-- read-only summary that the page metadata and the Open Graph image render.
--
-- It reveals nothing beyond what anyone holding the link already sees after
-- joining as a guest:
--
--   * a public session: title, host name, counts (never card text, votes
--     or participant names);
--   * a private session: only to a caller who can already open it (author,
--     participant or organization member), checked with the same
--     can_access_* helpers as the select policies;
--   * otherwise no row at all, so a private session and a missing one look
--     the same and the function cannot be used to probe which slugs exist.
--
-- Visibility follows the select policies exactly, so an archived session
-- previews for whoever can still open it.

BEGIN;

SET LOCAL lock_timeout = '3s';

CREATE OR REPLACE FUNCTION public.get_session_preview(p_kind text, p_slug text)
RETURNS TABLE (
  kind text,
  title text,
  host_name text,
  is_public boolean,
  is_locked boolean,
  participant_count integer,
  went_well_count integer,
  to_improve_count integer,
  action_item_count integer,
  round_count integer,
  voting_scale text[],
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_slug IS NULL OR length(p_slug) > 100 THEN
    RETURN;
  END IF;

  IF p_kind = 'retro' THEN
    RETURN QUERY
    SELECT
      'retro'::text,
      b.title,
      b.author_name,
      b.is_public,
      b.is_locked,
      (SELECT count(*)::integer FROM public.retro_participants p
        WHERE p.board_id = b.id),
      (SELECT count(*)::integer FROM public.retro_cards c
        WHERE c.board_id = b.id AND c.column_type = 'went_well'),
      (SELECT count(*)::integer FROM public.retro_cards c
        WHERE c.board_id = b.id AND c.column_type = 'to_improve'),
      (SELECT count(*)::integer FROM public.retro_cards c
        WHERE c.board_id = b.id AND c.column_type = 'action_items'),
      NULL::integer,
      NULL::text[],
      b.created_at
    FROM public.retro_boards b
    WHERE b.slug = p_slug
      AND public.can_access_board(b.id);
  ELSIF p_kind = 'poker' THEN
    RETURN QUERY
    SELECT
      'poker'::text,
      s.title,
      s.author_name,
      s.is_public,
      false,
      (SELECT count(*)::integer FROM public.poker_participants p
        WHERE p.session_id = s.id),
      NULL::integer,
      NULL::integer,
      NULL::integer,
      (SELECT count(*)::integer FROM public.poker_rounds r
        WHERE r.session_id = s.id),
      s.voting_scale,
      s.created_at
    FROM public.poker_sessions s
    WHERE s.slug = p_slug
      AND public.can_access_poker_session(s.id);
  END IF;
END;
$$;

COMMENT ON FUNCTION public.get_session_preview(text, text) IS
  'Link-preview summary of a retro board or poker session. Public sessions for anyone; private ones only for callers who can already open them.';

REVOKE ALL ON FUNCTION public.get_session_preview(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_session_preview(text, text)
TO anon, authenticated, service_role;

COMMIT;
