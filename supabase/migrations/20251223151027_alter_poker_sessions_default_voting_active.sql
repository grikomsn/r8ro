-- Update default value for is_voting_active to true
-- This makes new poker sessions start with voting enabled by default

ALTER TABLE public.poker_sessions
  ALTER COLUMN is_voting_active SET DEFAULT true;
