-- Restrict Realtime Presence to the boards and sessions a user can already
-- read.
--
-- The app joins a public Realtime channel named after the board or session
-- slug, for example retro-swift-owl-837. Public channels are readable by any
-- authenticated client, so the presence payloads, which contain the display
-- name and the user id, were readable for a board that had been made
-- private.
--
-- The client also has to set private: true on the channel, otherwise the
-- policy below is not consulted. Both halves are needed.
--
-- The policy checks the topic against the tables the user can already see.
-- The parent select policies are still enforced, so a user who cannot read a
-- private board cannot use its presence channel either.
--
-- Two details matter here.
--
-- The policy deliberately does not filter on the extension column. The
-- realtime server authorises a channel by inserting one probe row per
-- extension it may read, so a policy that only matched the presence
-- extension would still reject the channel because of the broadcast probe.
--
-- The server also authorises its own internal "realtime:api" topic, which it
-- uses to list the channels a user can see. That topic has no board behind
-- it, so it is allowed explicitly. It carries no user data, only the list of
-- topic names the caller is already allowed to join.
--
-- The read policy is the one that enforces access.
--
-- The insert policy is deliberately permissive. The realtime server inserts a
-- probe row to test whether the topic is visible, and that insert has to
-- succeed for the read test to be able to run. Restricting the insert by
-- topic would deny the probe itself and make every private channel fail to
-- subscribe. Presence writes are still confined to the topic the server
-- derives from the channel, and the read policy decides who can observe them.

BEGIN;

SET LOCAL lock_timeout = '3s';

DROP POLICY IF EXISTS r8ro_presence_read ON realtime.messages;

CREATE POLICY r8ro_presence_read
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = 'realtime:api'
  OR EXISTS (
    SELECT 1
    FROM public.retro_boards b
    WHERE realtime.topic() = 'retro-' || b.slug
  )
  OR EXISTS (
    SELECT 1
    FROM public.poker_sessions s
    WHERE realtime.topic() = 'poker-' || s.slug
  )
);

DROP POLICY IF EXISTS r8ro_presence_send ON realtime.messages;

CREATE POLICY r8ro_presence_send
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (true);

COMMIT;
