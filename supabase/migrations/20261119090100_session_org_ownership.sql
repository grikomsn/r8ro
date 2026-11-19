-- Let an organization own retro boards and poker sessions, and let a session
-- be archived.
--
-- retro_boards.org_id and poker_sessions.org_id are optional. A session with
-- no organization behaves exactly as before. For a session that belongs to an
-- organization:
--
--   * every member of the organization can read it and join it, also while it
--     is private. "Private" then means "the organization and the people who
--     already joined";
--   * owners and admins of the organization can do what the author can do:
--     rename, lock, change visibility, archive, delete and run the session
--     (timer, reveal, clear votes, next round);
--   * the link keeps working for everybody else as before. A public session is
--     still open to anyone with the link, guests included.
--
-- The author stays the author. author_id is immutable for API roles, and
-- org_id only changes through set_session_organization(), which checks who is
-- asking. A plain UPDATE cannot move a session into another organization or
-- hand it to another user, even though the update policy now also admits
-- organization managers.
--
-- archived_at is a filing flag. The application hides archived sessions from
-- the default lists; it does not change who can open them.

BEGIN;

SET LOCAL lock_timeout = '3s';

-- ============================================================================
-- COLUMNS
-- ============================================================================

ALTER TABLE public.retro_boards
  ADD COLUMN IF NOT EXISTS org_id uuid
    REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.poker_sessions
  ADD COLUMN IF NOT EXISTS org_id uuid
    REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS retro_boards_org_id_idx
  ON public.retro_boards (org_id)
  WHERE org_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS poker_sessions_org_id_idx
  ON public.poker_sessions (org_id)
  WHERE org_id IS NOT NULL;

-- ============================================================================
-- OWNERSHIP GUARD
-- ============================================================================

-- One function serves both tables: each has author_id and org_id.
--
-- r8ro.session_org_write is a transaction-local flag set only by
-- set_session_organization. Any SQL session could set it, but PostgREST
-- exposes no way to run set_config, so API clients cannot. Do not add a
-- public wrapper that sets arbitrary settings.
CREATE OR REPLACE FUNCTION public.protect_session_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- The account merge reassigns authorship as a service-role operation, and
  -- the table owner is how migrations and administrative tooling write.
  IF current_setting('role', true) IN ('service_role', 'none') THEN
    RETURN NEW;
  END IF;

  -- Referential actions, such as ON DELETE SET NULL when an organization is
  -- deleted, run inside another trigger.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.author_id IS DISTINCT FROM OLD.author_id THEN
    RAISE EXCEPTION 'The author of a session cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  -- Co-hosts (owners and admins of the organization) may run the session but
  -- not rewrite its identity: the address everyone shares, who created it,
  -- and when.
  IF OLD.author_id IS DISTINCT FROM (SELECT auth.uid()) AND (
    NEW.id IS DISTINCT FROM OLD.id
    OR NEW.slug IS DISTINCT FROM OLD.slug
    OR NEW.author_name IS DISTINCT FROM OLD.author_name
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Only the author can change the address, author name or creation time of a session'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.org_id IS DISTINCT FROM OLD.org_id
     AND COALESCE(current_setting('r8ro.session_org_write', true), '0') <> '1'
  THEN
    RAISE EXCEPTION 'Use set_session_organization to move a session'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.protect_session_ownership() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.protect_session_ownership()
FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS retro_boards_protect_ownership ON public.retro_boards;

CREATE TRIGGER retro_boards_protect_ownership
BEFORE UPDATE ON public.retro_boards
FOR EACH ROW
EXECUTE FUNCTION public.protect_session_ownership();

DROP TRIGGER IF EXISTS poker_sessions_protect_ownership
ON public.poker_sessions;

CREATE TRIGGER poker_sessions_protect_ownership
BEFORE UPDATE ON public.poker_sessions
FOR EACH ROW
EXECUTE FUNCTION public.protect_session_ownership();

-- Moves a session into an organization, to another one, or back to its
-- author (p_org_id NULL).
--
--   into or between organizations: the author only, and only into an
--     organization the author belongs to
--   out of an organization: the author, or an owner or admin of that
--     organization
CREATE OR REPLACE FUNCTION public.set_session_organization(
  p_kind text,
  p_session_id uuid,
  p_org_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  session_author uuid;
  current_org uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF p_kind = 'retro' THEN
    SELECT b.author_id, b.org_id
    INTO session_author, current_org
    FROM public.retro_boards b
    WHERE b.id = p_session_id
    FOR UPDATE;
  ELSIF p_kind = 'poker' THEN
    SELECT s.author_id, s.org_id
    INTO session_author, current_org
    FROM public.poker_sessions s
    WHERE s.id = p_session_id
    FOR UPDATE;
  ELSE
    RAISE EXCEPTION 'Unknown session kind'
      USING ERRCODE = '22023';
  END IF;

  -- A missing session and a session the caller has no say over get the same
  -- answer, so the function cannot be used to probe for ids.
  IF session_author IS NULL OR NOT (
    session_author = caller_id
    OR (current_org IS NOT NULL AND public.is_org_manager(current_org))
  ) THEN
    RAISE EXCEPTION 'You cannot move this session'
      USING ERRCODE = '42501';
  END IF;

  IF current_org IS NOT DISTINCT FROM p_org_id THEN
    RETURN;
  END IF;

  IF p_org_id IS NOT NULL THEN
    IF session_author <> caller_id THEN
      RAISE EXCEPTION 'Only the author can move a session into an organization'
        USING ERRCODE = '42501';
    END IF;

    IF NOT public.is_org_member(p_org_id) THEN
      RAISE EXCEPTION 'You are not a member of that organization'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  PERFORM set_config('r8ro.session_org_write', '1', true);

  IF p_kind = 'retro' THEN
    UPDATE public.retro_boards
    SET org_id = p_org_id
    WHERE id = p_session_id;
  ELSE
    UPDATE public.poker_sessions
    SET org_id = p_org_id
    WHERE id = p_session_id;
  END IF;

  PERFORM set_config('r8ro.session_org_write', '0', true);
END;
$$;

ALTER FUNCTION public.set_session_organization(text, uuid, uuid)
OWNER TO postgres;

REVOKE ALL ON FUNCTION public.set_session_organization(text, uuid, uuid)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.set_session_organization(text, uuid, uuid)
TO authenticated;

-- ============================================================================
-- ACCESS HELPERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_access_board(board_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.retro_boards b
    WHERE b.id = board_uuid AND (
      b.is_public = true
      OR b.author_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.retro_participants p
        WHERE p.board_id = board_uuid AND p.user_id = (SELECT auth.uid())
      )
      OR (b.org_id IS NOT NULL AND public.is_org_member(b.org_id))
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_poker_session(session_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.poker_sessions s
    WHERE s.id = session_uuid AND (
      s.is_public = true
      OR s.author_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.poker_participants p
        WHERE p.session_id = session_uuid AND p.user_id = (SELECT auth.uid())
      )
      OR (s.org_id IS NOT NULL AND public.is_org_member(s.org_id))
    )
  );
$$;

-- ============================================================================
-- RLS: retro_boards
-- ============================================================================

DROP POLICY IF EXISTS boards_select_policy ON public.retro_boards;

CREATE POLICY boards_select_policy
ON public.retro_boards
FOR SELECT
TO public
USING (
  (SELECT auth.uid()) IS NOT NULL AND (
    is_public = true
    OR author_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.retro_participants p
      WHERE p.board_id = retro_boards.id AND p.user_id = (SELECT auth.uid())
    )
    OR (org_id IS NOT NULL AND public.is_org_member(org_id))
  )
);

-- A board may only be created inside an organization the author belongs to.
DROP POLICY IF EXISTS boards_insert_policy ON public.retro_boards;

CREATE POLICY boards_insert_policy
ON public.retro_boards
FOR INSERT
TO public
WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL
  AND author_id = (SELECT auth.uid())
  AND (org_id IS NULL OR public.is_org_member(org_id))
);

-- USING decides who may touch the row. The new row is not compared with the
-- caller here, because an organization manager is not its author; the
-- protect_session_ownership trigger keeps author_id and org_id fixed instead.
DROP POLICY IF EXISTS boards_update_policy ON public.retro_boards;

CREATE POLICY boards_update_policy
ON public.retro_boards
FOR UPDATE
TO public
USING (
  (SELECT auth.uid()) = author_id
  OR (org_id IS NOT NULL AND public.is_org_manager(org_id))
)
WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS boards_delete_policy ON public.retro_boards;

CREATE POLICY boards_delete_policy
ON public.retro_boards
FOR DELETE
TO public
USING (
  (SELECT auth.uid()) = author_id
  OR (org_id IS NOT NULL AND public.is_org_manager(org_id))
);

-- ============================================================================
-- RLS: retro_participants, retro_cards, retro_card_votes
-- ============================================================================

-- A member may join a private board of their organization.
DROP POLICY IF EXISTS participants_insert_policy ON public.retro_participants;

CREATE POLICY participants_insert_policy
ON public.retro_participants
FOR INSERT
TO public
WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL
  AND user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.retro_boards b
    WHERE b.id = retro_participants.board_id AND (
      b.is_public = true
      OR b.author_id = (SELECT auth.uid())
      OR (b.org_id IS NOT NULL AND public.is_org_member(b.org_id))
    )
  )
);

-- The client reads the cards before it has inserted its participant row, so
-- the read policies have to admit an organization member directly.
DROP POLICY IF EXISTS cards_select_policy ON public.retro_cards;

CREATE POLICY cards_select_policy
ON public.retro_cards
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.retro_boards b
    WHERE b.id = retro_cards.board_id AND (
      b.is_public = true
      OR b.author_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.retro_participants p
        WHERE p.board_id = b.id AND p.user_id = (SELECT auth.uid())
      )
      OR (b.org_id IS NOT NULL AND public.is_org_member(b.org_id))
    )
  )
);

DROP POLICY IF EXISTS votes_select_policy ON public.retro_card_votes;

CREATE POLICY votes_select_policy
ON public.retro_card_votes
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.retro_cards c
    JOIN public.retro_boards b ON c.board_id = b.id
    WHERE c.id = retro_card_votes.card_id AND (
      b.is_public = true
      OR b.author_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.retro_participants p
        WHERE p.board_id = b.id AND p.user_id = (SELECT auth.uid())
      )
      OR (b.org_id IS NOT NULL AND public.is_org_member(b.org_id))
    )
  )
);

-- The card and vote write policies are unchanged. They require a participant
-- row on a private board, and a member gets one by opening the board.

-- ============================================================================
-- RLS: poker_sessions, poker_participants, poker_rounds
-- ============================================================================

DROP POLICY IF EXISTS poker_sessions_select_policy ON public.poker_sessions;

CREATE POLICY poker_sessions_select_policy
ON public.poker_sessions
FOR SELECT
TO public
USING (
  (SELECT auth.uid()) IS NOT NULL AND (
    is_public = true
    OR author_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.poker_participants p
      WHERE p.session_id = poker_sessions.id
        AND p.user_id = (SELECT auth.uid())
    )
    OR (org_id IS NOT NULL AND public.is_org_member(org_id))
  )
);

DROP POLICY IF EXISTS poker_sessions_insert_policy ON public.poker_sessions;

CREATE POLICY poker_sessions_insert_policy
ON public.poker_sessions
FOR INSERT
TO public
WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL
  AND author_id = (SELECT auth.uid())
  AND (org_id IS NULL OR public.is_org_member(org_id))
);

DROP POLICY IF EXISTS poker_sessions_update_policy ON public.poker_sessions;

CREATE POLICY poker_sessions_update_policy
ON public.poker_sessions
FOR UPDATE
TO public
USING (
  (SELECT auth.uid()) = author_id
  OR (org_id IS NOT NULL AND public.is_org_manager(org_id))
)
WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS poker_sessions_delete_policy ON public.poker_sessions;

CREATE POLICY poker_sessions_delete_policy
ON public.poker_sessions
FOR DELETE
TO public
USING (
  (SELECT auth.uid()) = author_id
  OR (org_id IS NOT NULL AND public.is_org_manager(org_id))
);

DROP POLICY IF EXISTS poker_participants_insert_policy
ON public.poker_participants;

CREATE POLICY poker_participants_insert_policy
ON public.poker_participants
FOR INSERT
TO public
WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL
  AND user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.poker_sessions s
    WHERE s.id = poker_participants.session_id AND (
      s.is_public = true
      OR s.author_id = (SELECT auth.uid())
      OR (s.org_id IS NOT NULL AND public.is_org_member(s.org_id))
    )
  )
);

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
      AND (
        s.author_id = (SELECT auth.uid())
        OR (s.org_id IS NOT NULL AND public.is_org_manager(s.org_id))
      )
  )
);

-- ============================================================================
-- HOST FUNCTIONS: the author, or a manager of the owning organization
-- ============================================================================

CREATE OR REPLACE FUNCTION public.clear_poker_votes(p_session_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  session_author uuid;
  session_org uuid;
  deleted_count bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  SELECT author_id, org_id
  INTO session_author, session_org
  FROM public.poker_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND OR NOT (
    session_author = auth.uid()
    OR (session_org IS NOT NULL AND public.is_org_manager(session_org))
  ) THEN
    RAISE EXCEPTION 'Only the session host may clear votes'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.poker_votes
  WHERE session_id = p_session_id;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

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

  IF NOT FOUND OR NOT (
    session_row.author_id = auth.uid()
    OR (
      session_row.org_id IS NOT NULL
      AND public.is_org_manager(session_row.org_id)
    )
  ) THEN
    RAISE EXCEPTION 'Only the session host may complete a round'
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

-- CREATE OR REPLACE keeps the owner and the grants made by the migrations
-- that introduced these two functions. They are restated so this file can be
-- read on its own.
ALTER FUNCTION public.clear_poker_votes(uuid) OWNER TO postgres;
ALTER FUNCTION public.complete_poker_round(uuid, text, text)
OWNER TO postgres;

REVOKE ALL ON FUNCTION public.clear_poker_votes(uuid)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.complete_poker_round(uuid, text, text)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.clear_poker_votes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_poker_round(uuid, text, text)
TO authenticated;

-- ============================================================================
-- LEAVING AN ORGANIZATION ENDS ACCESS TO ITS PRIVATE SESSIONS
-- ============================================================================

-- A participant row keeps a private session readable ("the people already on
-- it keep access"). For a private session of an organization that would let a
-- removed member keep reading it, so the rows are dropped when the membership
-- goes. The member's cards and recorded rounds stay. Sessions they authored
-- are left alone, and so are public sessions, which anyone can rejoin by
-- link.
--
-- Nothing is revoked while the organization itself is being deleted: its
-- sessions go back to their authors with the participants they had.
CREATE OR REPLACE FUNCTION public.revoke_org_session_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.organizations o WHERE o.id = OLD.org_id
  ) THEN
    RETURN NULL;
  END IF;

  -- A membership that was only moved to another account by the guest merge
  -- is replaced in the same statement; the old account has no rows left.
  DELETE FROM public.retro_participants p
  USING public.retro_boards b
  WHERE p.board_id = b.id
    AND p.user_id = OLD.user_id
    AND b.org_id = OLD.org_id
    AND b.is_public IS NOT TRUE
    AND b.author_id <> OLD.user_id;

  DELETE FROM public.poker_votes v
  USING public.poker_sessions s
  WHERE v.session_id = s.id
    AND v.user_id = OLD.user_id
    AND s.org_id = OLD.org_id
    AND s.is_public IS NOT TRUE
    AND s.author_id <> OLD.user_id;

  DELETE FROM public.poker_participants p
  USING public.poker_sessions s
  WHERE p.session_id = s.id
    AND p.user_id = OLD.user_id
    AND s.org_id = OLD.org_id
    AND s.is_public IS NOT TRUE
    AND s.author_id <> OLD.user_id;

  RETURN NULL;
END;
$$;

ALTER FUNCTION public.revoke_org_session_access() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.revoke_org_session_access()
FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS organization_members_revoke_session_access
ON public.organization_members;

CREATE TRIGGER organization_members_revoke_session_access
AFTER DELETE ON public.organization_members
FOR EACH ROW
EXECUTE FUNCTION public.revoke_org_session_access();

-- ============================================================================
-- SESSION LISTS
-- ============================================================================

-- The sessions behind "My sessions" (p_org_id NULL: everything the caller
-- created or joined) and behind an organization page (p_org_id set: every
-- session of that organization, for its members only).
--
-- SECURITY INVOKER: every table is read through the caller's own RLS, so the
-- function cannot return a row or a count the caller could not select.
CREATE OR REPLACE FUNCTION public.list_my_sessions(p_org_id uuid DEFAULT NULL)
RETURNS TABLE (
  kind text,
  id uuid,
  slug text,
  title text,
  author_id uuid,
  author_name text,
  org_id uuid,
  org_slug text,
  org_name text,
  is_public boolean,
  is_locked boolean,
  archived_at timestamptz,
  created_at timestamptz,
  is_author boolean,
  is_participant boolean,
  can_manage boolean,
  participant_count bigint,
  item_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT *
  FROM (
    SELECT
      'retro'::text AS kind,
      b.id,
      b.slug,
      b.title,
      b.author_id,
      b.author_name,
      b.org_id,
      o.slug AS org_slug,
      o.name AS org_name,
      COALESCE(b.is_public, true) AS is_public,
      COALESCE(b.is_locked, false) AS is_locked,
      b.archived_at,
      b.created_at,
      b.author_id = (SELECT auth.uid()) AS is_author,
      me.user_id IS NOT NULL AS is_participant,
      (
        b.author_id = (SELECT auth.uid())
        OR (b.org_id IS NOT NULL AND public.is_org_manager(b.org_id))
      ) AS can_manage,
      (
        SELECT count(*)
        FROM public.retro_participants p
        WHERE p.board_id = b.id
      ) AS participant_count,
      (
        SELECT count(*)
        FROM public.retro_cards c
        WHERE c.board_id = b.id
      ) AS item_count
    FROM public.retro_boards b
    LEFT JOIN public.organizations o ON o.id = b.org_id
    LEFT JOIN public.retro_participants me
      ON me.board_id = b.id
     AND me.user_id = (SELECT auth.uid())
    -- The candidate ids come from the author_id and participant user_id
    -- indexes, so the personal list never scans every board in the system.
    WHERE b.id IN (
      SELECT x.id
      FROM public.retro_boards x
      WHERE p_org_id IS NULL
        AND x.author_id = (SELECT auth.uid())
      UNION
      SELECT p.board_id
      FROM public.retro_participants p
      WHERE p_org_id IS NULL
        AND p.user_id = (SELECT auth.uid())
      UNION
      SELECT x.id
      FROM public.retro_boards x
      WHERE x.org_id = p_org_id
        AND public.is_org_member(p_org_id)
    )

    UNION ALL

    SELECT
      'poker'::text,
      s.id,
      s.slug,
      s.title,
      s.author_id,
      s.author_name,
      s.org_id,
      o.slug,
      o.name,
      COALESCE(s.is_public, true),
      NULL::boolean,
      s.archived_at,
      s.created_at,
      s.author_id = (SELECT auth.uid()),
      me.user_id IS NOT NULL,
      (
        s.author_id = (SELECT auth.uid())
        OR (s.org_id IS NOT NULL AND public.is_org_manager(s.org_id))
      ),
      (
        SELECT count(*)
        FROM public.poker_participants p
        WHERE p.session_id = s.id
      ),
      (
        SELECT count(*)
        FROM public.poker_rounds r
        WHERE r.session_id = s.id
      )
    FROM public.poker_sessions s
    LEFT JOIN public.organizations o ON o.id = s.org_id
    LEFT JOIN public.poker_participants me
      ON me.session_id = s.id
     AND me.user_id = (SELECT auth.uid())
    WHERE s.id IN (
      SELECT x.id
      FROM public.poker_sessions x
      WHERE p_org_id IS NULL
        AND x.author_id = (SELECT auth.uid())
      UNION
      SELECT p.session_id
      FROM public.poker_participants p
      WHERE p_org_id IS NULL
        AND p.user_id = (SELECT auth.uid())
      UNION
      SELECT x.id
      FROM public.poker_sessions x
      WHERE x.org_id = p_org_id
        AND public.is_org_member(p_org_id)
    )
  ) AS sessions
  ORDER BY sessions.created_at DESC, sessions.id
  LIMIT 500;
$$;

ALTER FUNCTION public.list_my_sessions(uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.list_my_sessions(uuid)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.list_my_sessions(uuid) TO authenticated;

COMMIT;
