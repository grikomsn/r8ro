-- Ensure realtime replication works for retro and poker tables
ALTER TABLE public.retro_boards REPLICA IDENTITY FULL;
ALTER TABLE public.retro_cards REPLICA IDENTITY FULL;
ALTER TABLE public.retro_participants REPLICA IDENTITY FULL;
ALTER TABLE public.retro_card_votes REPLICA IDENTITY FULL;
ALTER TABLE public.poker_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.poker_participants REPLICA IDENTITY FULL;
ALTER TABLE public.poker_votes REPLICA IDENTITY FULL;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT UNNEST(
      ARRAY[
        'retro_boards',
        'retro_cards',
        'retro_participants',
        'retro_card_votes',
        'poker_sessions',
        'poker_participants',
        'poker_votes'
      ]
    )
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE FORMAT('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
