-- Drop all existing RLS policies from all tables
DROP POLICY IF EXISTS "Public boards are viewable by everyone" ON retro_boards;
DROP POLICY IF EXISTS "Board authors can view their own boards" ON retro_boards;
DROP POLICY IF EXISTS "Board authors can update their own boards" ON retro_boards;
DROP POLICY IF EXISTS "Board authors can delete their own boards" ON retro_boards;
DROP POLICY IF EXISTS "Anyone can create boards" ON retro_boards;

DROP POLICY IF EXISTS "Participants can view cards on joined boards" ON retro_cards;
DROP POLICY IF EXISTS "Participants can update cards on joined boards" ON retro_cards;
DROP POLICY IF EXISTS "Participants can create cards on joined boards" ON retro_cards;
DROP POLICY IF EXISTS "Cards on public boards are viewable by everyone" ON retro_cards;
DROP POLICY IF EXISTS "Card authors can delete their own cards" ON retro_cards;

DROP POLICY IF EXISTS "Participants on public boards are viewable by everyone" ON retro_participants;
DROP POLICY IF EXISTS "Participants can view others on joined boards" ON retro_participants;
DROP POLICY IF EXISTS "Participants can update their own status" ON retro_participants;
DROP POLICY IF EXISTS "Participants can leave boards" ON retro_participants;
DROP POLICY IF EXISTS "Board authors can remove participants" ON retro_participants;
DROP POLICY IF EXISTS "Anyone can join boards" ON retro_participants;
