# Planning Poker

## Creation and Joining

- `app/poker/client-page.tsx` creates sessions and inserts the author into
  `poker_participants`.
- A linked user who belongs to an organization can choose which
  organization the session belongs to ("Belongs to"); see
  [organizations.md](organizations.md).
- Available presets are defined in `lib/constants/poker-scales.ts`: Fibonacci,
  T-shirt sizes, and linear 1–10.
- Joining accepts a session code or a pasted link, verifies that the session
  can be selected, stores it in recent history, and opens `/poker/[slug]`.
- New and newly joined participant rows set `is_observer` to `false`. Any
  participant can switch to observing from the session menu; their vote is
  withdrawn first, and observers are not counted as voters.
- Every scale includes `?`. Fibonacci and T-shirt also include `☕` for a
  break. Neither counts as an estimate.

## Session Behavior

- The author can edit the title and current story, change the scale, toggle
  public/private state, start or stop voting, reveal or hide votes, clear all
  votes, and delete the session.
- Participants can create, change, or withdraw their own vote while voting is
  active. A vote value must be on the session's voting scale.
- Before the reveal everyone sees who has voted, from
  `poker_participants.has_voted`, but not the values.
- Vote values remain hidden until reveal. This is enforced by the database, so
  the values cannot be read through the API before the reveal either.
- After the reveal everyone sees a distribution, a consensus notice when all
  estimates match, and otherwise a suggested estimate: the scale value nearest
  the average for numeric scales, or the median for T-shirt sizes. When the
  votes are more than one scale step apart, the lowest and highest voters are
  named so they can explain before a revote.
- The host saves a round with "Next story": the story, the chosen estimate
  and a snapshot of the votes are stored in `poker_rounds`, the votes are
  cleared, and voting opens on the next story. The history shows every round
  and a total for numeric estimates, and can be exported as Markdown.
- Changing the scale clears existing votes, because they may not exist on the
  new scale.
- A private session stays visible to the people already on it. Only the author
  and existing participants keep access.

"Revote" calls `clear_poker_votes(session_id)`, which removes every vote in
the session and is restricted to the session author, then hides the votes and
reopens voting. "Next story" calls `complete_poker_round`.

## Realtime

`app/poker/[slug]/PokerSessionClient.tsx` subscribes to session, participant,
and vote changes on `poker-${slug}`. Supabase Presence and
`poker_participants.is_online` drive online status.

## Main Components

- `components/poker/session-header.tsx`
- `components/poker/round-panel.tsx`: current story and the host controls
  (reveal, pause or open voting, revote, next story). On phones the controls
  are pinned to the bottom of the screen, and once votes are revealed the
  results move above the hand.
- `components/poker/voting-cards.tsx`: the participant's hand. Two even rows
  on phones and tablets, one row on wide screens.
- `components/poker/vote-results.tsx`: who has voted, then results after the
  reveal.
- `components/poker/round-history.tsx` and
  `components/poker/next-round-dialog.tsx`
- `lib/utils/poker-stats.ts`: consensus, suggested estimate, and spread.
- `components/shared/private-access-overlay.tsx`

The table definitions and policies originate in
`supabase/migrations/20250101000000_create_poker_tables.sql`.

## Hosts and Archive

- The host is the author, or an owner or admin of the organization that owns
  the session. Everything described above for "the author" applies to every
  host, including clearing votes, completing rounds and deleting rounds.
- A private session of an organization stays open to its members.
- "Archive session" in the session menu files it away; see
  [account.md](account.md#archive).
