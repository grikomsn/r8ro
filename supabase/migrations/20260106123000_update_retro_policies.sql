-- Allow participants to add/edit/delete cards and votes when board is unlocked

-- Retro cards policies
DROP POLICY IF EXISTS cards_insert_policy ON public.retro_cards;
DROP POLICY IF EXISTS cards_update_policy ON public.retro_cards;
DROP POLICY IF EXISTS cards_delete_policy ON public.retro_cards;

CREATE POLICY retro_cards_insert_unlocked_or_author ON public.retro_cards
FOR INSERT
TO public
WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL
  AND author_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM retro_boards
    WHERE retro_boards.id = retro_cards.board_id
      AND ((retro_boards.is_locked = false) OR (retro_boards.author_id = (SELECT auth.uid())))
      AND (
        retro_boards.is_public = true
        OR retro_boards.author_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM retro_participants
          WHERE retro_participants.board_id = retro_cards.board_id
            AND retro_participants.user_id = (SELECT auth.uid())
        )
      )
  )
);

CREATE POLICY retro_cards_update_unlocked_participants ON public.retro_cards
FOR UPDATE
TO public
USING (
  (SELECT auth.uid()) IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM retro_boards
    WHERE retro_boards.id = retro_cards.board_id
      AND ((retro_boards.is_locked = false) OR (retro_boards.author_id = (SELECT auth.uid())))
      AND (
        retro_boards.author_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM retro_participants
          WHERE retro_participants.board_id = retro_cards.board_id
            AND retro_participants.user_id = (SELECT auth.uid())
        )
      )
  )
)
WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM retro_boards
    WHERE retro_boards.id = retro_cards.board_id
      AND ((retro_boards.is_locked = false) OR (retro_boards.author_id = (SELECT auth.uid())))
      AND (
        retro_boards.author_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM retro_participants
          WHERE retro_participants.board_id = retro_cards.board_id
            AND retro_participants.user_id = (SELECT auth.uid())
        )
      )
  )
);

CREATE POLICY retro_cards_delete_unlocked_participants ON public.retro_cards
FOR DELETE
TO public
USING (
  (SELECT auth.uid()) IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM retro_boards
    WHERE retro_boards.id = retro_cards.board_id
      AND ((retro_boards.is_locked = false) OR (retro_boards.author_id = (SELECT auth.uid())))
      AND (
        retro_boards.author_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM retro_participants
          WHERE retro_participants.board_id = retro_cards.board_id
            AND retro_participants.user_id = (SELECT auth.uid())
        )
      )
  )
);

-- Retro votes policies
DROP POLICY IF EXISTS votes_insert_policy ON public.retro_card_votes;
DROP POLICY IF EXISTS votes_delete_policy ON public.retro_card_votes;

CREATE POLICY retro_votes_insert_unlocked_participants ON public.retro_card_votes
FOR INSERT
TO public
WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL
  AND user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM retro_cards
    JOIN retro_boards ON retro_cards.board_id = retro_boards.id
    WHERE retro_cards.id = retro_card_votes.card_id
      AND ((retro_boards.is_locked = false) OR (retro_boards.author_id = (SELECT auth.uid())))
      AND (
        retro_boards.is_public = true
        OR retro_boards.author_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM retro_participants
          WHERE retro_participants.board_id = retro_cards.board_id
            AND retro_participants.user_id = (SELECT auth.uid())
        )
      )
  )
);

CREATE POLICY retro_votes_delete_unlocked_participants ON public.retro_card_votes
FOR DELETE
TO public
USING (
  (SELECT auth.uid()) IS NOT NULL
  AND user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM retro_cards
    JOIN retro_boards ON retro_cards.board_id = retro_boards.id
    WHERE retro_cards.id = retro_card_votes.card_id
      AND ((retro_boards.is_locked = false) OR (retro_boards.author_id = (SELECT auth.uid())))
      AND (
        retro_boards.is_public = true
        OR retro_boards.author_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM retro_participants
          WHERE retro_participants.board_id = retro_cards.board_id
            AND retro_participants.user_id = (SELECT auth.uid())
        )
      )
  )
);
