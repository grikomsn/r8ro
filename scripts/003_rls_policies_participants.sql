-- RLS Policies for retro_participants table
-- Allows viewing participants on accessible boards and managing own participation

-- Policy: Anyone can view participants on public boards
CREATE POLICY "Participants on public boards are viewable by everyone"
ON public.retro_participants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.retro_boards
    WHERE retro_boards.id = retro_participants.board_id
    AND retro_boards.is_public = true
  )
);

-- Policy: Participants can view other participants on boards they've joined
CREATE POLICY "Participants can view others on joined boards"
ON public.retro_participants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.retro_participants AS rp
    WHERE rp.board_id = retro_participants.board_id
    AND rp.user_id = COALESCE(
      auth.uid()::text,
      current_setting('request.jwt.claims', true)::json->>'sub'
    )
  )
);

-- Policy: Anyone can join a board (insert participant record)
CREATE POLICY "Anyone can join boards"
ON public.retro_participants
FOR INSERT
WITH CHECK (true);

-- Policy: Participants can update their own status
CREATE POLICY "Participants can update their own status"
ON public.retro_participants
FOR UPDATE
USING (
  user_id = COALESCE(
    auth.uid()::text,
    current_setting('request.jwt.claims', true)::json->>'sub'
  )
);

-- Policy: Participants can leave boards (delete their own participation)
CREATE POLICY "Participants can leave boards"
ON public.retro_participants
FOR DELETE
USING (
  user_id = COALESCE(
    auth.uid()::text,
    current_setting('request.jwt.claims', true)::json->>'sub'
  )
);

-- Policy: Board authors can remove participants from their boards
CREATE POLICY "Board authors can remove participants"
ON public.retro_participants
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.retro_boards
    WHERE retro_boards.id = retro_participants.board_id
    AND retro_boards.author_id = COALESCE(
      auth.uid()::text,
      current_setting('request.jwt.claims', true)::json->>'sub'
    )
  )
);
