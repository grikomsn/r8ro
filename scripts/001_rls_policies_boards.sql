-- RLS Policies for retro_boards table
-- Allows public read access for public boards, and full control for board authors

-- Policy: Anyone can view public boards
CREATE POLICY "Public boards are viewable by everyone"
ON public.retro_boards
FOR SELECT
USING (is_public = true);

-- Policy: Board authors can view their own boards (including private ones)
CREATE POLICY "Board authors can view their own boards"
ON public.retro_boards
FOR SELECT
USING (auth.uid()::text = author_id OR author_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Policy: Anyone can create a board
CREATE POLICY "Anyone can create boards"
ON public.retro_boards
FOR INSERT
WITH CHECK (true);

-- Policy: Only board authors can update their boards
CREATE POLICY "Board authors can update their own boards"
ON public.retro_boards
FOR UPDATE
USING (auth.uid()::text = author_id OR author_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Policy: Only board authors can delete their boards
CREATE POLICY "Board authors can delete their own boards"
ON public.retro_boards
FOR DELETE
USING (auth.uid()::text = author_id OR author_id = current_setting('request.jwt.claims', true)::json->>'sub');
