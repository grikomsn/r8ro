-- Migration: Create poker session tables
-- Based on retro_boards pattern

-- ============================================================================
-- TABLES (must be created before helper functions that reference them)
-- ============================================================================

-- poker_sessions table
CREATE TABLE IF NOT EXISTS public.poker_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT 'Untitled Poker Session'::text,
  author_id uuid NOT NULL,
  author_name text NOT NULL,
  voting_scale text[] NOT NULL DEFAULT ARRAY['1', '2', '3', '5', '8', '13', '21', '?']::text[],
  current_story text,
  votes_revealed boolean DEFAULT false,
  is_voting_active boolean DEFAULT false,
  is_public boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT poker_sessions_author_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- poker_participants table
CREATE TABLE IF NOT EXISTS public.poker_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  username text NOT NULL,
  is_online boolean DEFAULT true,
  is_observer boolean DEFAULT false,
  joined_at timestamptz DEFAULT now(),
  CONSTRAINT poker_participants_session_id_fkey FOREIGN KEY (session_id) REFERENCES poker_sessions(id) ON DELETE CASCADE,
  CONSTRAINT poker_participants_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT poker_participants_session_user_unique UNIQUE(session_id, user_id)
);

-- poker_votes table
CREATE TABLE IF NOT EXISTS public.poker_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  vote_value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT poker_votes_session_id_fkey FOREIGN KEY (session_id) REFERENCES poker_sessions(id) ON DELETE CASCADE,
  CONSTRAINT poker_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE(session_id, user_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_poker_sessions_slug ON public.poker_sessions(slug);
CREATE INDEX IF NOT EXISTS idx_poker_sessions_author_id ON public.poker_sessions(author_id);
CREATE INDEX IF NOT EXISTS idx_poker_sessions_is_public ON public.poker_sessions(is_public);

CREATE INDEX IF NOT EXISTS idx_poker_participants_session_id ON public.poker_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_poker_participants_user_id ON public.poker_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_poker_votes_session_id ON public.poker_votes(session_id);
CREATE INDEX IF NOT EXISTS idx_poker_votes_user_id ON public.poker_votes(user_id);

-- ============================================================================
-- HELPER FUNCTIONS (created after tables)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_access_poker_session(session_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM poker_sessions
    WHERE id = session_uuid AND (
      is_public = true
      OR author_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM poker_participants
        WHERE session_id = session_uuid AND user_id = (SELECT auth.uid())
      )
    )
  );
$$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.poker_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poker_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poker_votes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: poker_sessions
-- ============================================================================

-- SELECT: Public sessions OR private sessions where user is participant OR user is author
CREATE POLICY "poker_sessions_select_policy" ON public.poker_sessions FOR SELECT
  USING (
    (SELECT auth.uid()) IS NOT NULL AND (
      is_public = true
      OR author_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM poker_participants
        WHERE session_id = poker_sessions.id AND user_id = (SELECT auth.uid())
      )
    )
  );

-- INSERT: Any authenticated user can create sessions
CREATE POLICY "poker_sessions_insert_policy" ON public.poker_sessions FOR INSERT
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND author_id = (SELECT auth.uid()));

-- UPDATE: Only session author can update
CREATE POLICY "poker_sessions_update_policy" ON public.poker_sessions FOR UPDATE
  USING ((SELECT auth.uid()) = author_id)
  WITH CHECK ((SELECT auth.uid()) = author_id);

-- DELETE: Only session author can delete
CREATE POLICY "poker_sessions_delete_policy" ON public.poker_sessions FOR DELETE
  USING ((SELECT auth.uid()) = author_id);

-- ============================================================================
-- RLS POLICIES: poker_participants
-- ============================================================================

-- SELECT: Can see participants if you can access the session
CREATE POLICY "poker_participants_select_policy" ON public.poker_participants FOR SELECT
  USING (can_access_poker_session(session_id));

-- INSERT: Can join public sessions OR sessions you're the author of
CREATE POLICY "poker_participants_insert_policy" ON public.poker_participants FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM poker_sessions
      WHERE id = session_id AND (
        is_public = true
        OR author_id = (SELECT auth.uid())
      )
    )
  );

-- UPDATE: Can update own participant record
CREATE POLICY "poker_participants_update_policy" ON public.poker_participants FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- DELETE: Can leave sessions (delete own participant record)
CREATE POLICY "poker_participants_delete_policy" ON public.poker_participants FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- ============================================================================
-- RLS POLICIES: poker_votes
-- ============================================================================

-- SELECT: Can see votes if you can access the session
CREATE POLICY "poker_votes_select_policy" ON public.poker_votes FOR SELECT
  USING (can_access_poker_session(session_id));

-- INSERT: Can vote if session accessible, voting active, and not observer
CREATE POLICY "poker_votes_insert_policy" ON public.poker_votes FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM poker_sessions
      WHERE id = session_id
        AND is_voting_active = true
        AND (
          is_public = true
          OR author_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM poker_participants
            WHERE session_id = poker_sessions.id AND user_id = (SELECT auth.uid())
          )
        )
    )
    AND NOT EXISTS (
      SELECT 1 FROM poker_participants
      WHERE session_id = poker_votes.session_id
        AND user_id = (SELECT auth.uid())
        AND is_observer = true
    )
  );

-- UPDATE: Can update own vote if voting still active
CREATE POLICY "poker_votes_update_policy" ON public.poker_votes FOR UPDATE
  USING (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM poker_sessions
      WHERE id = session_id AND is_voting_active = true
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM poker_sessions
      WHERE id = session_id AND is_voting_active = true
    )
  );

-- DELETE: Can remove own votes
CREATE POLICY "poker_votes_delete_policy" ON public.poker_votes FOR DELETE
  USING ((SELECT auth.uid()) = user_id);
