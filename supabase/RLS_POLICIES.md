# Row Level Security Reference

SQL is authoritative. This file summarizes the policies created by
`20241231000000_create_retro_tables.sql`, `20250101000000_create_poker_tables.sql`,
`20260106123000_update_retro_policies.sql`,
`20261021090600_enforce_poker_vote_rules.sql`, `20261119090000_organizations.sql`
and `20261119090100_session_org_ownership.sql`.

"Host" below means the author, or an owner or admin of the organization that
owns the session (`is_org_manager(org_id)`). "Org member" means a member of
that organization (`is_org_member(org_id)`).

`supabase/schema.sql` is a reference dump and is not applied.

## Retro

### `retro_boards`

- `boards_select_policy`: authenticated users can select public boards, boards
  they authored, boards in which they are participants, or boards of an
  organization they belong to.
- `boards_insert_policy`: authenticated users can insert with themselves as
  author, and with an `org_id` only for an organization they belong to.
- `boards_update_policy` and `boards_delete_policy`: hosts. The
  `retro_boards_protect_ownership` trigger rejects a change to `author_id` or
  `org_id` outside `set_session_organization`, and a change to `id`, `slug`,
  `author_name` or `created_at` by a co-host.

### `retro_participants`

- `participants_select_policy`: delegates to `can_access_board`.
- `participants_insert_policy`: self only, for a public board, its author, or
  an org member.
- `participants_update_policy` and `participants_delete_policy`: self only.

### `retro_cards`

The 2026 policy migration replaces the baseline mutation policies:

- `cards_select_policy`: public board, author, participant, or org member.
- `retro_cards_insert_unlocked_or_author`: self-authored insert on an
  accessible board that is unlocked, or on a board the user authored.
- `retro_cards_update_unlocked_participants`: any participant or board author
  can update any card while allowed by the lock rule.
- `retro_cards_delete_unlocked_participants`: the same access rule for delete.

The update and delete policies do not compare `retro_cards.author_id` with the
current user. The identity columns of a card are protected by the
`prevent_card_identity_change` trigger instead, which rejects a change to
`id`, `board_id`, `author_id`, `author_name`, or to the `votes` counter.

### `retro_card_votes`

- `votes_select_policy`: the same rule as `cards_select_policy`, through the
  card's board.
- `retro_votes_insert_unlocked_participants`: self-owned vote on an accessible
  board that passes the lock rule.
- `retro_votes_delete_unlocked_participants`: self-owned vote with the same
  board access and lock checks.

The vote count shown on a card is `retro_cards.votes`, which the
`sync_retro_card_vote_count` trigger keeps in step with these rows.

## Poker

### `poker_sessions`

- Select: authenticated public access, authorship, existing participation, or
  org member.
- Insert: authenticated user as author; an `org_id` requires membership.
- Update/delete: hosts. `poker_sessions_protect_ownership` guards `author_id`
  and `org_id` as for boards.

### `poker_participants`

- Select: delegates to `can_access_poker_session`.
- Insert: self only, for a public session, its author, or an org member.
- Update/delete: self only.

### `poker_votes`

- `poker_votes_select_policy`: a participant sees their own vote, and sees
  everybody's vote once the session is revealed.
- `poker_votes_insert_policy`: self only while voting is active, the user is
  not an observer, and the value is on the session's voting scale.
- `poker_votes_update_policy`: the same conditions for a vote change.
- `poker_votes_delete_policy`: self only.

A host clears every vote in the session with
`public.clear_poker_votes(session_id)`, which checks the caller itself.

`poker_participants.has_voted` is kept in step by the
`poker_votes_sync_has_voted` trigger, and the
`poker_participants_protect_has_voted` trigger discards a direct client write
to it (`20261116120100_poker_participant_vote_status.sql`).

### `poker_rounds`

- `poker_rounds_select_policy`: anyone who can access the session.
- `poker_rounds_delete_policy`: hosts.
- There is no insert or update policy. Rows are written by
  `public.complete_poker_round(session_id, estimate, next_story)`, which checks
  that the caller is a host.

## Organizations

All three tables are read-only to API roles; writes go through
`SECURITY DEFINER` functions that check the caller's role.

### `organizations`

- `organizations_select_member`: members only.

### `organization_members`

- `organization_members_select_member`: members of the same organization.
- Triggers: `organization_members_keep_owner` promotes a new owner when the
  last one disappears (or deletes an empty organization), and
  `organization_members_revoke_session_access` removes a departing member's
  participant rows, and withdraws their current poker votes, in the
  organization's private sessions they did not author.

### `organization_invites`

- `organization_invites_select_manager`: owners and admins only. Everyone
  else previews an invite through `get_organization_invite(code)`.

## Link Previews

`get_session_preview(kind, slug)` is not a policy but bypasses them, so it is
listed here. It is `SECURITY DEFINER` and executable by `anon`, and returns a
row only when `can_access_board` / `can_access_poker_session` allows the
caller: public sessions for everyone, private ones for their author,
participants and organization members. It returns counts, never card text,
votes or participant names.

## Realtime

`20260106120000_enable_realtime_replication.sql` gives all application tables
`REPLICA IDENTITY FULL` and adds them to the `supabase_realtime` publication.
The organization tables are not replicated.
