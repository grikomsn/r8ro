-- Let the retro timer pause and resume instead of resetting.
--
-- Pausing used to clear timer_started_at, so resuming always restarted the
-- countdown from the full duration. timer_seconds keeps its meaning (the
-- configured duration) and timer_remaining_seconds holds what was left when
-- the timer was paused. A NULL value means the timer is not paused part way.
--
-- While the timer runs, clients compute the remaining time as
--   COALESCE(timer_remaining_seconds, timer_seconds) - (now - timer_started_at)

BEGIN;

SET LOCAL lock_timeout = '3s';

ALTER TABLE public.retro_boards
  ADD COLUMN IF NOT EXISTS timer_remaining_seconds integer;

ALTER TABLE public.retro_boards
  DROP CONSTRAINT IF EXISTS retro_boards_timer_remaining_seconds_check;

ALTER TABLE public.retro_boards
  ADD CONSTRAINT retro_boards_timer_remaining_seconds_check
  CHECK (timer_remaining_seconds IS NULL OR timer_remaining_seconds >= 0);

COMMIT;
