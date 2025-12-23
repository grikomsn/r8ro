-- Supabase Schema and RLS Policies Dump
-- Generated for r8ro retro app
-- This file contains the complete database schema including tables, constraints, indexes, functions, and RLS policies

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_access_board(board_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM retro_boards
    WHERE id = board_uuid AND (
      is_public = true
      OR author_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM retro_participants
        WHERE board_id = board_uuid AND user_id = (SELECT auth.uid())
      )
    )
  );
$$;

-- ============================================================================
-- TABLES
-- ============================================================================

-- retro_boards table
CREATE TABLE IF NOT EXISTS public.retro_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT 'Untitled Retro'::text,
  author_id uuid NOT NULL,
  author_name text NOT NULL,
  is_public boolean DEFAULT true,
  is_locked boolean DEFAULT false,
  timer_running boolean DEFAULT false,
  timer_seconds integer DEFAULT 0,
  timer_started_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT retro_boards_author_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- retro_cards table
CREATE TABLE IF NOT EXISTS public.retro_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL,
  column_type text NOT NULL CHECK (column_type = ANY (ARRAY['went_well'::text, 'to_improve'::text, 'action_items'::text])),
  content text NOT NULL,
  author_name text NOT NULL,
  author_id uuid NOT NULL,
  votes integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT retro_cards_board_id_fkey FOREIGN KEY (board_id) REFERENCES retro_boards(id) ON DELETE CASCADE,
  CONSTRAINT retro_cards_author_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- retro_participants table
CREATE TABLE IF NOT EXISTS public.retro_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL,
  user_id uuid NOT NULL,
  username text NOT NULL,
  is_online boolean DEFAULT true,
  joined_at timestamptz DEFAULT now(),
  CONSTRAINT retro_participants_board_id_fkey FOREIGN KEY (board_id) REFERENCES retro_boards(id) ON DELETE CASCADE,
  CONSTRAINT retro_participants_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT retro_participants_board_user_unique UNIQUE(board_id, user_id)
);

-- retro_card_votes table
CREATE TABLE IF NOT EXISTS public.retro_card_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT retro_card_votes_card_id_fkey FOREIGN KEY (card_id) REFERENCES retro_cards(id) ON DELETE CASCADE,
  CONSTRAINT retro_card_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE(card_id, user_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_retro_boards_slug ON public.retro_boards(slug);
CREATE INDEX IF NOT EXISTS idx_retro_boards_author_id ON public.retro_boards(author_id);
CREATE INDEX IF NOT EXISTS idx_retro_boards_is_public ON public.retro_boards(is_public);

CREATE INDEX IF NOT EXISTS idx_retro_cards_board_id ON public.retro_cards(board_id);
CREATE INDEX IF NOT EXISTS idx_retro_cards_author_id ON public.retro_cards(author_id);

CREATE INDEX IF NOT EXISTS idx_retro_participants_board_id ON public.retro_participants(board_id);
CREATE INDEX IF NOT EXISTS idx_retro_participants_user_id ON public.retro_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_retro_card_votes_card_id ON public.retro_card_votes(card_id);
CREATE INDEX IF NOT EXISTS idx_retro_card_votes_user_id ON public.retro_card_votes(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.retro_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retro_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retro_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retro_card_votes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: retro_boards
-- ============================================================================

-- SELECT: Public boards OR private boards where user is participant OR user is author
CREATE POLICY "boards_select_policy" ON public.retro_boards FOR SELECT
  USING (
    (SELECT auth.uid()) IS NOT NULL AND (
      is_public = true
      OR author_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM retro_participants
        WHERE board_id = retro_boards.id AND user_id = (SELECT auth.uid())
      )
    )
  );

-- INSERT: Any authenticated user can create boards
CREATE POLICY "boards_insert_policy" ON public.retro_boards FOR INSERT
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND author_id = (SELECT auth.uid()));

-- UPDATE: Only board author can update
CREATE POLICY "boards_update_policy" ON public.retro_boards FOR UPDATE
  USING ((SELECT auth.uid()) = author_id)
  WITH CHECK ((SELECT auth.uid()) = author_id);

-- DELETE: Only board author can delete
CREATE POLICY "boards_delete_policy" ON public.retro_boards FOR DELETE
  USING ((SELECT auth.uid()) = author_id);

-- ============================================================================
-- RLS POLICIES: retro_participants
-- ============================================================================

-- SELECT: Can see participants if you can access the board (using helper function to avoid recursion)
CREATE POLICY "participants_select_policy" ON public.retro_participants FOR SELECT
  USING (can_access_board(board_id));

-- INSERT: Can join public boards OR boards you're the author of
CREATE POLICY "participants_insert_policy" ON public.retro_participants FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM retro_boards
      WHERE id = board_id AND (
        is_public = true
        OR author_id = (SELECT auth.uid())
      )
    )
  );

-- UPDATE: Can update own participant record
CREATE POLICY "participants_update_policy" ON public.retro_participants FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- DELETE: Can leave boards (delete own participant record)
CREATE POLICY "participants_delete_policy" ON public.retro_participants FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- ============================================================================
-- RLS POLICIES: retro_cards
-- ============================================================================

-- SELECT: Can see cards if you can see the board
CREATE POLICY "cards_select_policy" ON public.retro_cards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM retro_boards
      WHERE id = board_id AND (
        is_public = true
        OR author_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM retro_participants
          WHERE board_id = retro_boards.id AND user_id = (SELECT auth.uid())
        )
      )
    )
  );

-- INSERT: Can add cards if board not locked OR you're the author
CREATE POLICY "cards_insert_policy" ON public.retro_cards FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND author_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM retro_boards
      WHERE id = board_id
        AND (is_locked = false OR author_id = (SELECT auth.uid()))
        AND (
          is_public = true
          OR author_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM retro_participants
            WHERE board_id = retro_boards.id AND user_id = (SELECT auth.uid())
          )
        )
    )
  );

-- UPDATE: Can edit own cards if board not locked OR you're board author
CREATE POLICY "cards_update_policy" ON public.retro_cards FOR UPDATE
  USING (
    (SELECT auth.uid()) = author_id
    AND EXISTS (
      SELECT 1 FROM retro_boards
      WHERE id = board_id AND (is_locked = false OR author_id = (SELECT auth.uid()))
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) = author_id
    AND EXISTS (
      SELECT 1 FROM retro_boards
      WHERE id = board_id AND (is_locked = false OR author_id = (SELECT auth.uid()))
    )
  );

-- DELETE: Can delete own cards if board not locked OR you're board author
CREATE POLICY "cards_delete_policy" ON public.retro_cards FOR DELETE
  USING (
    (SELECT auth.uid()) = author_id
    AND EXISTS (
      SELECT 1 FROM retro_boards
      WHERE id = board_id AND (is_locked = false OR author_id = (SELECT auth.uid()))
    )
  );

-- ============================================================================
-- RLS POLICIES: retro_card_votes
-- ============================================================================

-- SELECT: Can see votes if you can see the card's board
CREATE POLICY "votes_select_policy" ON public.retro_card_votes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM retro_cards
      JOIN retro_boards ON retro_cards.board_id = retro_boards.id
      WHERE retro_cards.id = card_id AND (
        retro_boards.is_public = true
        OR retro_boards.author_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM retro_participants
          WHERE board_id = retro_boards.id AND user_id = (SELECT auth.uid())
        )
      )
    )
  );

-- INSERT: Can vote if board accessible and not locked (or you're author)
CREATE POLICY "votes_insert_policy" ON public.retro_card_votes FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM retro_cards
      JOIN retro_boards ON retro_cards.board_id = retro_boards.id
      WHERE retro_cards.id = card_id
        AND (retro_boards.is_locked = false OR retro_boards.author_id = (SELECT auth.uid()))
        AND (
          retro_boards.is_public = true
          OR retro_boards.author_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM retro_participants
            WHERE board_id = retro_boards.id AND user_id = (SELECT auth.uid())
          )
        )
    )
  );

-- DELETE: Can remove own votes
CREATE POLICY "votes_delete_policy" ON public.retro_card_votes FOR DELETE
  USING ((SELECT auth.uid()) = user_id);
