-- RLS Policies for retro_cards table
-- Allows participants to view cards on boards they have access to

-- Policy: Anyone can view cards on public boards
CREATE POLICY "Cards on public boards are viewable by everyone"
ON public.retro_cards
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.retro_boards
    WHERE retro_boards.id = retro_cards.board_id
    AND retro_boards.is_public = true
  )
);

-- Policy: Participants can view cards on boards they've joined
CREATE POLICY "Participants can view cards on joined boards"
ON public.retro_cards
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.retro_participants
    WHERE retro_participants.board_id = retro_cards.board_id
    AND retro_participants.user_id = COALESCE(
      auth.uid()::text,
      current_setting('request.jwt.claims', true)::json->>'sub'
    )
  )
);

-- Policy: Participants can create cards on boards they've joined
CREATE POLICY "Participants can create cards on joined boards"
ON public.retro_cards
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.retro_participants
    WHERE retro_participants.board_id = retro_cards.board_id
    AND retro_participants.user_id = COALESCE(
      auth.uid()::text,
      current_setting('request.jwt.claims', true)::json->>'sub'
    )
  )
);

-- Policy: Participants can update any card on boards they've joined (for voting and editing)
CREATE POLICY "Participants can update cards on joined boards"
ON public.retro_cards
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.retro_participants
    WHERE retro_participants.board_id = retro_cards.board_id
    AND retro_participants.user_id = COALESCE(
      auth.uid()::text,
      current_setting('request.jwt.claims', true)::json->>'sub'
    )
  )
);

-- Policy: Card authors and board authors can delete cards
CREATE POLICY "Card authors can delete their own cards"
ON public.retro_cards
FOR DELETE
USING (
  author_id = COALESCE(
    auth.uid()::text,
    current_setting('request.jwt.claims', true)::json->>'sub'
  )
  OR EXISTS (
    SELECT 1 FROM public.retro_boards
    WHERE retro_boards.id = retro_cards.board_id
    AND retro_boards.author_id = COALESCE(
      auth.uid()::text,
      current_setting('request.jwt.claims', true)::json->>'sub'
    )
  )
);
