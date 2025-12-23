-- ============================================================================
-- OPTIMIZED RLS POLICIES - NO RECURSION
-- ============================================================================
-- Key optimization: Use direct column checks instead of subqueries
-- This prevents infinite recursion by avoiding nested policy evaluations
-- ============================================================================

-- ============================================================================
-- RETRO_BOARDS POLICIES
-- ============================================================================

-- Allow anyone to create boards (no conditions = always true)
CREATE POLICY "boards_insert_policy"
ON retro_boards FOR INSERT
TO authenticated, anon
WITH CHECK (true);

-- Allow viewing public boards
CREATE POLICY "boards_select_public_policy"
ON retro_boards FOR SELECT
TO authenticated, anon
USING (is_public = true);

-- Allow board authors to view their own boards
CREATE POLICY "boards_select_author_policy"
ON retro_boards FOR SELECT
TO authenticated, anon
USING (author_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Allow board authors to update their own boards
CREATE POLICY "boards_update_author_policy"
ON retro_boards FOR UPDATE
TO authenticated, anon
USING (author_id = current_setting('request.jwt.claims', true)::json->>'sub')
WITH CHECK (author_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Allow board authors to delete their own boards
CREATE POLICY "boards_delete_author_policy"
ON retro_boards FOR DELETE
TO authenticated, anon
USING (author_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- ============================================================================
-- RETRO_CARDS POLICIES
-- ============================================================================

-- Allow viewing cards on public boards (direct board_id check, no subquery)
CREATE POLICY "cards_select_public_policy"
ON retro_cards FOR SELECT
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 FROM retro_boards 
    WHERE retro_boards.id = retro_cards.board_id 
    AND retro_boards.is_public = true
  )
);

-- Allow viewing cards where user is a participant (direct participant check)
CREATE POLICY "cards_select_participant_policy"
ON retro_cards FOR SELECT
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 FROM retro_participants
    WHERE retro_participants.board_id = retro_cards.board_id
    AND retro_participants.user_id = current_setting('request.jwt.claims', true)::json->>'sub'
  )
);

-- Allow viewing cards where user is the board author
CREATE POLICY "cards_select_author_policy"
ON retro_cards FOR SELECT
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 FROM retro_boards
    WHERE retro_boards.id = retro_cards.board_id
    AND retro_boards.author_id = current_setting('request.jwt.claims', true)::json->>'sub'
  )
);

-- Allow creating cards on public boards or boards where user is a participant
CREATE POLICY "cards_insert_policy"
ON retro_cards FOR INSERT
TO authenticated, anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM retro_boards
    WHERE retro_boards.id = retro_cards.board_id
    AND (
      retro_boards.is_public = true
      OR retro_boards.author_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  )
  OR EXISTS (
    SELECT 1 FROM retro_participants
    WHERE retro_participants.board_id = retro_cards.board_id
    AND retro_participants.user_id = current_setting('request.jwt.claims', true)::json->>'sub'
  )
);

-- Allow updating cards on boards where user is a participant or author
CREATE POLICY "cards_update_policy"
ON retro_cards FOR UPDATE
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 FROM retro_boards
    WHERE retro_boards.id = retro_cards.board_id
    AND (
      retro_boards.is_public = true
      OR retro_boards.author_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  )
  OR EXISTS (
    SELECT 1 FROM retro_participants
    WHERE retro_participants.board_id = retro_cards.board_id
    AND retro_participants.user_id = current_setting('request.jwt.claims', true)::json->>'sub'
  )
);

-- Allow card authors to delete their own cards
CREATE POLICY "cards_delete_author_policy"
ON retro_cards FOR DELETE
TO authenticated, anon
USING (author_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Allow board authors to delete any card on their boards
CREATE POLICY "cards_delete_board_author_policy"
ON retro_cards FOR DELETE
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 FROM retro_boards
    WHERE retro_boards.id = retro_cards.board_id
    AND retro_boards.author_id = current_setting('request.jwt.claims', true)::json->>'sub'
  )
);

-- ============================================================================
-- RETRO_PARTICIPANTS POLICIES
-- ============================================================================

-- Allow viewing participants on public boards
CREATE POLICY "participants_select_public_policy"
ON retro_participants FOR SELECT
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 FROM retro_boards
    WHERE retro_boards.id = retro_participants.board_id
    AND retro_boards.is_public = true
  )
);

-- Allow viewing participants where user is also a participant
CREATE POLICY "participants_select_peer_policy"
ON retro_participants FOR SELECT
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 FROM retro_participants AS peer
    WHERE peer.board_id = retro_participants.board_id
    AND peer.user_id = current_setting('request.jwt.claims', true)::json->>'sub'
  )
);

-- Allow viewing participants where user is the board author
CREATE POLICY "participants_select_author_policy"
ON retro_participants FOR SELECT
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 FROM retro_boards
    WHERE retro_boards.id = retro_participants.board_id
    AND retro_boards.author_id = current_setting('request.jwt.claims', true)::json->>'sub'
  )
);

-- Allow anyone to join boards (create participant record)
CREATE POLICY "participants_insert_policy"
ON retro_participants FOR INSERT
TO authenticated, anon
WITH CHECK (true);

-- Allow users to update their own participant status
CREATE POLICY "participants_update_self_policy"
ON retro_participants FOR UPDATE
TO authenticated, anon
USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub')
WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Allow users to leave boards (delete their own participant record)
CREATE POLICY "participants_delete_self_policy"
ON retro_participants FOR DELETE
TO authenticated, anon
USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Allow board authors to remove participants from their boards
CREATE POLICY "participants_delete_author_policy"
ON retro_participants FOR DELETE
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 FROM retro_boards
    WHERE retro_boards.id = retro_participants.board_id
    AND retro_boards.author_id = current_setting('request.jwt.claims', true)::json->>'sub'
  )
);
