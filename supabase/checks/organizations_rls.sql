-- RLS and RPC behaviour checks for the organization migrations.
-- Run as postgres against a database with every migration applied:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/checks/organizations_rls.sql
-- Everything runs in one transaction that is rolled back.
\set QUIET 1
\pset format unaligned
\pset tuples_only on

BEGIN;

-- ---------------------------------------------------------------------------
-- Test helpers (dropped by the rollback)
-- ---------------------------------------------------------------------------
CREATE SCHEMA t;
GRANT USAGE ON SCHEMA t TO authenticated, anon, service_role;

CREATE TABLE t.results (n serial, ok boolean, label text);
GRANT ALL ON t.results TO authenticated, anon, service_role;
GRANT ALL ON SEQUENCE t.results_n_seq TO authenticated, anon, service_role;

-- Become an API user for the rest of the transaction.
CREATE FUNCTION t.login(p_user uuid, p_role text DEFAULT 'authenticated')
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    CASE WHEN p_user IS NULL THEN '{"role":"anon"}'
         ELSE json_build_object('sub', p_user, 'role', p_role)::text END, true);
  EXECUTE format('SET LOCAL ROLE %I', p_role);
END $$;

CREATE FUNCTION t.ok(p_cond boolean, p_label text) RETURNS void
LANGUAGE sql AS $$ INSERT INTO t.results (ok, label) VALUES (COALESCE(p_cond, false), p_label) $$;

-- Passes when the statement raises; optionally checks the message.
CREATE FUNCTION t.throws(p_sql text, p_like text, p_label text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO t.results (ok, label)
    VALUES (SQLERRM ILIKE '%' || p_like || '%', p_label || ' [' || SQLERRM || ']');
    RETURN;
  END;
  INSERT INTO t.results (ok, label) VALUES (false, p_label || ' [no error raised]');
END $$;

-- Passes when the statement affects zero rows (RLS filtered it out).
CREATE FUNCTION t.affects(p_sql text, p_expected bigint, p_label text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE p_sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  INSERT INTO t.results (ok, label) VALUES (n = p_expected, p_label || ' [rows=' || n || ']');
END $$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t TO authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- Users: alice, bob, carol, dave are GitHub-linked; gina and gus are guests;
-- erin is registered (not anonymous) but has no GitHub identity.
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, instance_id, aud, role, is_anonymous, raw_user_meta_data)
VALUES
  ('a0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', false, '{"display_name":"Alice","avatar_url":"https://example.test/a.png","user_name":"alice-gh"}'),
  ('b0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', false, '{"display_name":"Bob"}'),
  ('c0000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', false, '{"display_name":"Carol"}'),
  ('d0000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', false, '{"display_name":"Dave"}'),
  ('e0000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true,  '{"display_name":"Gina Guest"}'),
  ('f0000000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true,  '{"display_name":"Gus Guest"}'),
  ('70000000-0000-4000-8000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', false, '{"display_name":"Erin Email","user_name":"alice-gh","avatar_url":"https://evil.test/x.png"}');

-- GitHub identities. User metadata above deliberately disagrees for alice
-- (avatar) and erin (claims alice's handle) to prove only identities count.
INSERT INTO auth.identities (provider_id, user_id, identity_data, provider)
VALUES
  ('1001', 'a0000000-0000-4000-8000-000000000001', '{"sub":"1001","user_name":"alice-gh","avatar_url":"https://avatars.example.test/alice.png"}', 'github'),
  ('1002', 'b0000000-0000-4000-8000-000000000002', '{"sub":"1002","user_name":"bob-gh"}', 'github'),
  ('1003', 'c0000000-0000-4000-8000-000000000003', '{"sub":"1003","user_name":"carol-gh"}', 'github'),
  ('1004', 'd0000000-0000-4000-8000-000000000004', '{"sub":"1004","user_name":"dave-gh"}', 'github');

\set alice '\'a0000000-0000-4000-8000-000000000001\''
\set bob   '\'b0000000-0000-4000-8000-000000000002\''
\set carol '\'c0000000-0000-4000-8000-000000000003\''
\set dave  '\'d0000000-0000-4000-8000-000000000004\''
\set gina  '\'e0000000-0000-4000-8000-000000000005\''
\set gus   '\'f0000000-0000-4000-8000-000000000006\''
\set erin  '\'70000000-0000-4000-8000-000000000007\''

-- ===========================================================================
-- 1. Creating an organization
-- ===========================================================================
SELECT t.login(:gina);
SELECT t.throws($$SELECT public.create_organization('Guest Org')$$, 'Link a GitHub account', '1.1 guest cannot create an organization');

SELECT t.login(:erin);
SELECT t.throws($$SELECT public.create_organization('Email Org')$$, 'Link a GitHub account', '1.1a a registered account without a GitHub identity cannot create an organization');

SELECT t.login(:alice);
SELECT t.ok((SELECT slug FROM public.create_organization('  Acme   Team ')) = 'acme-team', '1.2 slug is derived from the name');
SELECT t.ok((SELECT name FROM public.organizations WHERE slug = 'acme-team') = 'Acme Team', '1.3 name is normalised');
SELECT t.ok(public.org_role((SELECT id FROM public.organizations WHERE slug = 'acme-team')) = 'owner', '1.4 creator is owner');
SELECT t.ok((SELECT slug FROM public.create_organization('Acme Team')) ~ '^acme-team-[0-9]{4}$', '1.5 taken slug gets a suffix');
SELECT t.ok((SELECT slug FROM public.create_organization('new')) ~ '^new-[0-9]{4}$', '1.6 reserved slug gets a suffix');
SELECT t.ok((SELECT slug FROM public.create_organization('日本')) ~ '^team-[0-9]{4}$', '1.7 non-latin name falls back to team-NNNN');
SELECT t.throws($$SELECT public.create_organization('   ')$$, 'between 1 and 80', '1.8 empty name is rejected');
SELECT t.throws($$INSERT INTO public.organizations (slug, name) VALUES ('direct', 'Direct')$$, 'permission denied', '1.9 direct insert into organizations is denied');
SELECT t.throws($$INSERT INTO public.organization_members (org_id, user_id, role) SELECT id, auth.uid(), 'owner' FROM public.organizations LIMIT 1$$, 'permission denied', '1.10 direct insert into organization_members is denied');

RESET ROLE;
CREATE TEMP TABLE ids AS SELECT id AS acme FROM public.organizations WHERE slug = 'acme-team';
GRANT SELECT ON ids TO authenticated, anon, service_role;

-- ===========================================================================
-- 2. Reading: members only
-- ===========================================================================
SELECT t.login(:bob);
SELECT t.ok((SELECT count(*) FROM public.organizations) = 0, '2.1 non-member reads no organization');
SELECT t.ok((SELECT count(*) FROM public.organization_members) = 0, '2.2 non-member reads no membership');
SELECT t.ok((SELECT count(*) FROM public.organization_invites) = 0, '2.3 non-member reads no invite');
SELECT t.throws($$SELECT * FROM public.list_organization_members((SELECT acme FROM ids))$$, 'not a member', '2.4 non-member cannot list members');
SELECT t.ok((SELECT count(*) FROM public.list_my_organizations()) = 0, '2.5 non-member has no organizations');
SELECT t.throws($$SELECT public.update_organization((SELECT acme FROM ids), 'Hacked')$$, 'owner or admin', '2.6 non-member cannot rename');
SELECT t.throws($$SELECT public.delete_organization((SELECT acme FROM ids))$$, 'Only an owner', '2.7 non-member cannot delete');
SELECT t.throws($$SELECT public.rotate_organization_invite((SELECT acme FROM ids))$$, 'owner or admin', '2.8 non-member cannot create an invite');

SELECT t.login(NULL, 'anon');
SELECT t.throws($$SELECT count(*) FROM public.organizations$$, 'permission denied', '2.9 anon has no privilege on organizations');
-- Existing behaviour, unchanged by these migrations: the anon role is refused
-- because the select policy reads the participants table, which anon has no
-- privilege on. What matters here is that the refusal is still that one and
-- not a new "permission denied for function is_org_member".
SELECT t.throws($$SELECT count(*) FROM public.retro_boards$$, 'table retro_participants', '2.10 anon on retro_boards fails exactly as before (not on the new helpers)');
SELECT t.throws($$SELECT count(*) FROM public.poker_sessions$$, 'table poker_participants', '2.11 anon on poker_sessions fails exactly as before (not on the new helpers)');

-- ===========================================================================
-- 3. Invites
-- ===========================================================================
SELECT t.login(:alice);
CREATE TEMP TABLE inv AS SELECT code FROM public.rotate_organization_invite((SELECT acme FROM ids), 7);
GRANT SELECT, UPDATE, INSERT, DELETE ON inv TO authenticated, anon, service_role;
SELECT t.ok((SELECT code ~ '^[A-Za-z0-9_-]{22}$' FROM inv), '3.1 invite code is 22 url-safe characters');
SELECT t.ok((SELECT expires_at > now() + interval '6 days' FROM public.organization_invites), '3.2 invite expires in 7 days');

SELECT t.login(:gina);
SELECT t.ok((SELECT org_name FROM public.get_organization_invite((SELECT code FROM inv))) = 'Acme Team', '3.3 guest can preview an invite');
SELECT t.throws($$SELECT public.accept_organization_invite((SELECT code FROM inv))$$, 'Link a GitHub account', '3.4 guest cannot accept an invite');

SELECT t.login(:erin);
SELECT t.throws($$SELECT public.accept_organization_invite((SELECT code FROM inv))$$, 'Link a GitHub account', '3.4a a registered account without a GitHub identity cannot accept an invite');

SELECT t.login(:bob);
SELECT t.ok((SELECT count(*) FROM public.get_organization_invite('not-a-real-code-000000')) = 0, '3.5 unknown code previews nothing');
SELECT t.throws($$SELECT public.accept_organization_invite('not-a-real-code-000000')$$, 'not valid', '3.6 unknown code cannot be accepted');
SELECT t.ok((SELECT NOT is_member AND NOT is_expired AND member_count = 1 FROM public.get_organization_invite((SELECT code FROM inv))), '3.7 preview before joining');
SELECT t.ok(public.accept_organization_invite((SELECT code FROM inv)) = 'acme-team', '3.8 bob joins by invite');
SELECT t.ok(public.org_role((SELECT acme FROM ids)) = 'member', '3.9 invitee joins as member');
SELECT t.ok(public.accept_organization_invite((SELECT code FROM inv)) = 'acme-team', '3.10 accepting twice is idempotent');
SELECT t.ok((SELECT count(*) FROM public.organization_members) = 2, '3.11 member sees both memberships');
SELECT t.ok((SELECT count(*) FROM public.organization_invites) = 0, '3.12 plain member cannot read the invite code');
SELECT t.ok((SELECT display_name || '/' || COALESCE(github_username, '-') FROM public.list_organization_members((SELECT acme FROM ids)) WHERE role = 'owner') = 'Alice/alice-gh', '3.13 member list exposes display name and GitHub handle');
SELECT t.ok((SELECT avatar_url FROM public.list_organization_members((SELECT acme FROM ids)) WHERE role = 'owner') = 'https://avatars.example.test/alice.png', '3.13a avatar comes from the GitHub identity, not user metadata');

SELECT t.login(:carol);
SELECT t.ok(public.accept_organization_invite((SELECT code FROM inv)) = 'acme-team', '3.14 carol joins by invite');

-- rotation invalidates the old code
SELECT t.login(:alice);
CREATE TEMP TABLE inv2 AS SELECT code FROM public.rotate_organization_invite((SELECT acme FROM ids), NULL);
GRANT SELECT ON inv2 TO authenticated, anon, service_role;
SELECT t.ok((SELECT expires_at IS NULL FROM public.organization_invites), '3.15 NULL days means no expiry');
SELECT t.ok((SELECT count(*) FROM public.organization_invites) = 1, '3.16 one invite row per organization');
SELECT t.throws($$SELECT public.rotate_organization_invite((SELECT acme FROM ids), 0)$$, 'between 1 and 365', '3.17 expiry is bounded');

SELECT t.login(:dave);
SELECT t.throws($$SELECT public.accept_organization_invite((SELECT code FROM inv))$$, 'not valid', '3.18 rotated-away code no longer works');

-- expiry
RESET ROLE;
UPDATE public.organization_invites SET expires_at = now() - interval '1 minute';
SELECT t.login(:dave);
SELECT t.ok((SELECT is_expired FROM public.get_organization_invite((SELECT code FROM inv2))), '3.19 preview reports an expired invite');
SELECT t.throws($$SELECT public.accept_organization_invite((SELECT code FROM inv2))$$, 'expired', '3.20 expired code cannot be accepted');

-- revoke
SELECT t.login(:alice);
SELECT public.revoke_organization_invite((SELECT acme FROM ids));
SELECT t.ok((SELECT count(*) FROM public.organization_invites) = 0, '3.21 revoke removes the invite');

-- ===========================================================================
-- 4. Roles
-- ===========================================================================
SELECT t.login(:bob);
SELECT t.throws(format($$SELECT public.set_organization_member_role((SELECT acme FROM ids), %L, 'owner')$$, 'b0000000-0000-4000-8000-000000000002'), 'Only an owner', '4.1 member cannot make themselves owner');
SELECT t.throws(format($$SELECT public.set_organization_member_role((SELECT acme FROM ids), %L, 'admin')$$, 'b0000000-0000-4000-8000-000000000002'), 'Only an owner', '4.2 member cannot make themselves admin');
SELECT t.throws($$UPDATE public.organization_members SET role = 'owner' WHERE user_id = auth.uid()$$, 'permission denied', '4.3 direct role update is denied');
SELECT t.throws(format($$SELECT public.remove_organization_member((SELECT acme FROM ids), %L)$$, 'c0000000-0000-4000-8000-000000000003'), 'cannot remove', '4.4 member cannot remove another member');

SELECT t.login(:alice);
SELECT t.throws(format($$SELECT public.set_organization_member_role((SELECT acme FROM ids), %L, 'member')$$, 'a0000000-0000-4000-8000-000000000001'), 'at least one owner', '4.5 last owner cannot demote themselves');
SELECT t.throws(format($$SELECT public.remove_organization_member((SELECT acme FROM ids), %L)$$, 'a0000000-0000-4000-8000-000000000001'), 'only owner', '4.6 last owner cannot leave');
SELECT t.throws(format($$SELECT public.set_organization_member_role((SELECT acme FROM ids), %L, 'superuser')$$, 'b0000000-0000-4000-8000-000000000002'), 'Unknown role', '4.7 unknown role is rejected');
SELECT t.throws(format($$SELECT public.set_organization_member_role((SELECT acme FROM ids), %L, 'admin')$$, 'd0000000-0000-4000-8000-000000000004'), 'not a member', '4.8 cannot set the role of a non-member');
SELECT public.set_organization_member_role((SELECT acme FROM ids), :bob, 'admin');

SELECT t.login(:bob);
SELECT t.ok(public.org_role((SELECT acme FROM ids)) = 'admin', '4.9 owner promoted bob to admin');
SELECT t.throws(format($$SELECT public.set_organization_member_role((SELECT acme FROM ids), %L, 'owner')$$, 'b0000000-0000-4000-8000-000000000002'), 'Only an owner', '4.10 admin cannot make themselves owner');
SELECT t.throws(format($$SELECT public.remove_organization_member((SELECT acme FROM ids), %L)$$, 'a0000000-0000-4000-8000-000000000001'), 'cannot remove', '4.11 admin cannot remove an owner');
SELECT t.throws($$SELECT public.delete_organization((SELECT acme FROM ids))$$, 'Only an owner', '4.12 admin cannot delete the organization');
SELECT t.ok((SELECT name FROM public.update_organization((SELECT acme FROM ids), 'Acme Inc')) = 'Acme Inc', '4.13 admin can rename');
SELECT t.ok((SELECT slug FROM public.organizations WHERE id = (SELECT acme FROM ids)) = 'acme-team', '4.14 rename keeps the slug');
SELECT t.ok((SELECT count(*) FROM (SELECT public.rotate_organization_invite((SELECT acme FROM ids), 30)) x) = 1, '4.15 admin can create an invite');
SELECT t.ok((SELECT count(*) FROM public.organization_invites) = 1, '4.16 admin can read the invite');

-- ===========================================================================
-- 5. Organization sessions
-- ===========================================================================
-- carol (member) creates a private retro board and a private poker session in the organization
SELECT t.login(:carol);
INSERT INTO public.retro_boards (slug, title, author_id, author_name, is_public, org_id)
VALUES ('org-private-retro', 'Org private retro', auth.uid(), 'Carol', false, (SELECT acme FROM ids));
INSERT INTO public.retro_participants (board_id, user_id, username)
SELECT id, auth.uid(), 'Carol' FROM public.retro_boards WHERE slug = 'org-private-retro';
INSERT INTO public.retro_cards (board_id, column_type, content, author_name, author_id)
SELECT id, 'went_well', 'Shipped it', 'Carol', auth.uid() FROM public.retro_boards WHERE slug = 'org-private-retro';
INSERT INTO public.poker_sessions (slug, title, author_id, author_name, is_public, org_id)
VALUES ('org-private-poker', 'Org private poker', auth.uid(), 'Carol', false, (SELECT acme FROM ids));
INSERT INTO public.poker_participants (session_id, user_id, username)
SELECT id, auth.uid(), 'Carol' FROM public.poker_sessions WHERE slug = 'org-private-poker';
INSERT INTO public.poker_votes (session_id, user_id, vote_value)
SELECT id, auth.uid(), '5' FROM public.poker_sessions WHERE slug = 'org-private-poker';
-- a personal private board, to prove organization rules do not leak onto it
INSERT INTO public.retro_boards (slug, title, author_id, author_name, is_public)
VALUES ('carol-personal', 'Carol personal', auth.uid(), 'Carol', false);
-- a public organization board
INSERT INTO public.retro_boards (slug, title, author_id, author_name, is_public, org_id)
VALUES ('org-public-retro', 'Org public retro', auth.uid(), 'Carol', true, (SELECT acme FROM ids));
SELECT t.ok((SELECT count(*) FROM public.retro_boards WHERE org_id = (SELECT acme FROM ids)) = 2, '5.1 member creates boards in the organization');

SELECT t.login(:dave);
SELECT t.throws($$INSERT INTO public.retro_boards (slug, title, author_id, author_name, org_id) VALUES ('dave-sneak', 'x', auth.uid(), 'Dave', (SELECT acme FROM ids))$$, 'row-level security', '5.2 non-member cannot create a board in the organization');
SELECT t.throws($$INSERT INTO public.poker_sessions (slug, title, author_id, author_name, org_id) VALUES ('dave-sneak-p', 'x', auth.uid(), 'Dave', (SELECT acme FROM ids))$$, 'row-level security', '5.3 non-member cannot create a poker session in the organization');
SELECT t.ok((SELECT count(*) FROM public.retro_boards WHERE slug = 'org-private-retro') = 0, '5.4 non-member cannot read a private organization board');
SELECT t.ok((SELECT count(*) FROM public.retro_boards WHERE slug = 'org-public-retro') = 1, '5.5 anyone signed in can still read a public organization board by link');
SELECT t.ok((SELECT count(*) FROM public.poker_sessions WHERE slug = 'org-private-poker') = 0, '5.6 non-member cannot read a private organization poker session');
-- Scoped to this board's card: a populated database has public cards that
-- every signed-in user can read.
SELECT t.ok((SELECT count(*) FROM public.retro_cards WHERE author_id = :carol AND content = 'Shipped it') = 0, '5.7 non-member cannot read cards of a private organization board');
SELECT t.affects($$INSERT INTO public.retro_participants (board_id, user_id, username) SELECT id, auth.uid(), 'Dave' FROM public.retro_boards WHERE slug = 'org-private-retro'$$, 0, '5.8 non-member cannot join a private organization board (board is invisible)');
SELECT t.ok((SELECT count(*) FROM public.list_my_sessions((SELECT acme FROM ids))) = 0, '5.9 non-member gets nothing from the organization session list, public boards included');
INSERT INTO public.retro_participants (board_id, user_id, username)
SELECT id, auth.uid(), 'Dave' FROM public.retro_boards WHERE slug = 'org-public-retro';
SELECT t.ok((SELECT count(*) FROM public.retro_participants WHERE user_id = auth.uid()) = 1, '5.10 non-member joins a public organization board by link');

SELECT t.login(:gina);
INSERT INTO public.retro_participants (board_id, user_id, username)
SELECT id, auth.uid(), 'Gina Guest' FROM public.retro_boards WHERE slug = 'org-public-retro';
INSERT INTO public.retro_cards (board_id, column_type, content, author_name, author_id)
SELECT id, 'to_improve', 'Guest card', 'Gina Guest', auth.uid() FROM public.retro_boards WHERE slug = 'org-public-retro';
SELECT t.ok((SELECT count(*) FROM public.retro_cards WHERE author_id = auth.uid()) = 1, '5.11 a guest joins and writes on a public organization board by link');

-- bob is an admin, has not joined the private board
SELECT t.login(:bob);
SELECT t.ok((SELECT count(*) FROM public.retro_boards WHERE slug = 'org-private-retro') = 1, '5.12 member reads a private organization board');
SELECT t.ok((SELECT count(*) FROM public.retro_cards c JOIN public.retro_boards b ON b.id = c.board_id WHERE b.slug = 'org-private-retro') = 1, '5.13 member reads its cards before joining');
SELECT t.ok((SELECT count(*) FROM public.retro_participants p JOIN public.retro_boards b ON b.id = p.board_id WHERE b.slug = 'org-private-retro') = 1, '5.14 member reads its participants before joining');
SELECT t.ok((SELECT count(*) FROM public.retro_boards WHERE slug = 'carol-personal') = 0, '5.15 a personal private board of a fellow member stays private');
INSERT INTO public.retro_participants (board_id, user_id, username)
SELECT id, auth.uid(), 'Bob' FROM public.retro_boards WHERE slug = 'org-private-retro';
INSERT INTO public.retro_cards (board_id, column_type, content, author_name, author_id)
SELECT id, 'to_improve', 'More tests', 'Bob', auth.uid() FROM public.retro_boards WHERE slug = 'org-private-retro';
SELECT t.ok((SELECT count(*) FROM public.retro_cards c JOIN public.retro_boards b ON b.id = c.board_id WHERE b.slug = 'org-private-retro') = 2, '5.16 member joins a private organization board and adds a card');
INSERT INTO public.poker_participants (session_id, user_id, username)
SELECT id, auth.uid(), 'Bob' FROM public.poker_sessions WHERE slug = 'org-private-poker';
SELECT t.ok((SELECT count(*) FROM public.poker_participants p JOIN public.poker_sessions s ON s.id = p.session_id WHERE s.slug = 'org-private-poker') = 2, '5.17 member joins a private organization poker session');
SELECT t.ok((SELECT count(*) FROM public.list_my_sessions((SELECT acme FROM ids))) = 3, '5.18 organization session list shows all three sessions');
SELECT t.ok((SELECT bool_and(can_manage) AND NOT bool_or(is_author) FROM public.list_my_sessions((SELECT acme FROM ids))), '5.19 admin can_manage sessions they did not author');
SELECT t.ok((SELECT count(*) FROM public.list_my_sessions()) = 2, '5.20 personal list shows only sessions bob created or joined');
SELECT t.ok((SELECT org_name FROM public.list_my_sessions() WHERE slug = 'org-private-retro') = 'Acme Inc', '5.21 session list carries the organization name for members');

-- admin manages
SELECT t.affects($$UPDATE public.retro_boards SET title = 'Renamed by admin', is_locked = true, archived_at = now() WHERE slug = 'org-private-retro'$$, 1, '5.22 admin renames, locks and archives an organization board');
SELECT t.throws($$UPDATE public.retro_boards SET author_id = auth.uid() WHERE slug = 'org-private-retro'$$, 'author of a session cannot be changed', '5.23 admin cannot take over authorship');
SELECT t.throws($$UPDATE public.retro_boards SET org_id = NULL WHERE slug = 'org-private-retro'$$, 'set_session_organization', '5.24 org_id cannot be changed by a plain update');
SELECT t.affects($$UPDATE public.retro_boards SET title = 'nope' WHERE slug = 'carol-personal'$$, 0, '5.25 admin cannot update a personal board of a member');
SELECT t.throws($$UPDATE public.retro_boards SET slug = 'hijacked-slug' WHERE slug = 'org-private-retro'$$, 'Only the author', '5.25a co-host cannot change a board address');
SELECT t.throws($$UPDATE public.retro_boards SET author_name = 'Someone else' WHERE slug = 'org-private-retro'$$, 'Only the author', '5.25b co-host cannot change the author name');
SELECT t.throws($$UPDATE public.poker_sessions SET created_at = now() - interval '1 year' WHERE slug = 'org-private-poker'$$, 'Only the author', '5.25c co-host cannot change the creation time');
SELECT t.ok(public.clear_poker_votes((SELECT id FROM public.poker_sessions WHERE slug = 'org-private-poker')) = 1, '5.26 admin clears votes in an organization poker session');
SELECT t.ok(public.complete_poker_round((SELECT id FROM public.poker_sessions WHERE slug = 'org-private-poker'), '5', 'Next') IS NOT NULL, '5.27 admin completes a round');
SELECT t.affects($$DELETE FROM public.poker_rounds$$, 1, '5.28 admin deletes a round');
SELECT t.affects($$UPDATE public.poker_sessions SET votes_revealed = true WHERE slug = 'org-private-poker'$$, 1, '5.29 admin reveals votes');

-- plain member (not author) cannot manage; make dave a plain member first
SELECT t.login(:dave);
RESET ROLE;
INSERT INTO public.organization_members (org_id, user_id, role) VALUES ((SELECT acme FROM ids), :dave, 'member');
SELECT t.login(:dave);
SELECT t.affects($$UPDATE public.retro_boards SET title = 'member edit' WHERE slug = 'org-private-retro'$$, 0, '5.31 plain member cannot update a board they did not author');
SELECT t.affects($$DELETE FROM public.retro_boards WHERE slug = 'org-private-retro'$$, 0, '5.32 plain member cannot delete a board they did not author');
SELECT t.throws($$SELECT public.clear_poker_votes((SELECT id FROM public.poker_sessions WHERE slug = 'org-private-poker'))$$, 'host', '5.33 plain member cannot clear votes');
SELECT t.throws($$SELECT public.set_session_organization('retro', (SELECT id FROM public.retro_boards WHERE slug = 'org-private-retro'), NULL)$$, 'cannot move', '5.34 plain member cannot detach a board they did not author');
SELECT t.ok((SELECT NOT can_manage FROM public.list_my_sessions((SELECT acme FROM ids)) WHERE slug = 'org-private-retro'), '5.35 list reports can_manage = false for a plain member');

-- moving sessions
SELECT t.login(:carol);
SELECT public.set_session_organization('retro', (SELECT id FROM public.retro_boards WHERE slug = 'carol-personal'), (SELECT acme FROM ids));
SELECT t.ok((SELECT org_id FROM public.retro_boards WHERE slug = 'carol-personal') = (SELECT acme FROM ids), '5.37 author moves a personal board into their organization');
SELECT public.set_session_organization('retro', (SELECT id FROM public.retro_boards WHERE slug = 'carol-personal'), NULL);
SELECT t.ok((SELECT org_id FROM public.retro_boards WHERE slug = 'carol-personal') IS NULL, '5.38 author moves it back out');
RESET ROLE;
CREATE TEMP TABLE other AS SELECT id FROM public.organizations WHERE slug LIKE 'acme-team-%';
GRANT SELECT ON other TO authenticated;
SELECT t.login(:carol);
SELECT t.throws($$SELECT public.set_session_organization('retro', (SELECT id FROM public.retro_boards WHERE slug = 'carol-personal'), (SELECT id FROM other))$$, 'not a member of that organization', '5.39 author cannot move a board into an organization they are not in');
SELECT t.throws($$SELECT public.set_session_organization('retro', gen_random_uuid(), NULL)$$, 'cannot move', '5.40 unknown session id gets the same refusal');

SELECT t.login(:bob);
SELECT t.throws($$SELECT public.set_session_organization('retro', (SELECT id FROM public.retro_boards WHERE slug = 'org-public-retro'), (SELECT id FROM other))$$, 'Only the author', '5.41 admin cannot move a board to another organization');
SELECT public.set_session_organization('retro', (SELECT id FROM public.retro_boards WHERE slug = 'org-public-retro'), NULL);
RESET ROLE;
SELECT t.ok((SELECT org_id IS NULL FROM public.retro_boards WHERE slug = 'org-public-retro'), '5.42 admin detaches a board from the organization');

-- link previews (get_session_preview)
SELECT t.login(NULL, 'anon');
SELECT t.ok((SELECT title = 'Org public retro' AND host_name = 'Carol' AND to_improve_count = 1 FROM public.get_session_preview('retro', 'org-public-retro')), '5.43 anyone, signed out included, previews a public board');
SELECT t.ok((SELECT count(*) FROM public.get_session_preview('retro', 'org-private-retro')) = 0, '5.44 signed out gets no preview of a private board');
SELECT t.ok((SELECT count(*) FROM public.get_session_preview('poker', 'org-private-poker')) = 0, '5.45 signed out gets no preview of a private poker session');
SELECT t.ok((SELECT count(*) FROM public.get_session_preview('retro', 'no-such-board')) = 0, '5.46 a missing board looks the same as a private one');
SELECT t.ok((SELECT count(*) FROM public.get_session_preview('poker', 'org-public-retro')) = 0, '5.47 the kind must match the session');
SELECT t.login(:erin);
SELECT t.ok((SELECT count(*) FROM public.get_session_preview('retro', 'org-private-retro')) = 0, '5.48 a signed-in stranger gets no preview of a private board');
SELECT t.login(:carol);
-- org-private-retro was archived by its manager above; archiving hides it
-- from lists, not from people who can open it.
SELECT t.ok((SELECT went_well_count = 1 AND NOT is_public FROM public.get_session_preview('retro', 'org-private-retro')), '5.49 a member previews a private (archived) organization board');
SELECT t.ok((SELECT title = 'Org private poker' AND NOT is_public AND participant_count >= 1 FROM public.get_session_preview('poker', 'org-private-poker')), '5.50 a member previews a private organization poker session');
RESET ROLE;

-- ===========================================================================
-- 6. Removing members and leaving
-- ===========================================================================
SELECT t.login(:bob);
DELETE FROM inv;
INSERT INTO inv SELECT code FROM public.organization_invites WHERE org_id = (SELECT acme FROM ids);
SELECT public.remove_organization_member((SELECT acme FROM ids), :dave);
SELECT t.ok((SELECT count(*) FROM public.organization_members WHERE user_id = 'd0000000-0000-4000-8000-000000000004') = 0, '6.1 admin removes a plain member');
SELECT t.ok((SELECT code FROM public.organization_invites WHERE org_id = (SELECT acme FROM ids)) <> (SELECT code FROM inv), '6.1a removing someone replaces the invite code');

SELECT t.login(:dave);
SELECT t.ok((SELECT count(*) FROM public.retro_boards WHERE slug = 'org-private-retro') = 0, '6.2 removed member loses access to private organization boards');
SELECT t.throws($$SELECT public.accept_organization_invite((SELECT code FROM inv))$$, 'not valid', '6.2d a removed member cannot rejoin with the old invite link');

-- bob (admin) joined the private board and the private poker session in section 5
SELECT t.login(:alice);
SELECT public.set_organization_member_role((SELECT acme FROM ids), :bob, 'member');
SELECT public.remove_organization_member((SELECT acme FROM ids), :bob);
SELECT t.login(:bob);
SELECT t.ok((SELECT count(*) FROM public.retro_boards WHERE slug = 'org-private-retro') = 0, '6.2a a removed member who had joined a private organization board loses it');
SELECT t.ok((SELECT count(*) FROM public.poker_sessions WHERE slug = 'org-private-poker') = 0, '6.2b and the private organization poker session');
RESET ROLE;
SELECT t.ok((SELECT count(*) FROM public.retro_cards WHERE author_id = :bob) = 1, '6.2c their cards stay on the board');
INSERT INTO public.organization_members (org_id, user_id, role) VALUES ((SELECT acme FROM ids), :bob, 'admin');

RESET ROLE;
DELETE FROM inv;
INSERT INTO inv SELECT code FROM public.organization_invites WHERE org_id = (SELECT acme FROM ids);
SELECT t.login(:carol);
SELECT public.remove_organization_member((SELECT acme FROM ids), :carol);
SELECT t.ok(public.org_role((SELECT acme FROM ids)) IS NULL, '6.3 member leaves');
RESET ROLE;
SELECT t.ok((SELECT code FROM public.organization_invites WHERE org_id = (SELECT acme FROM ids)) = (SELECT code FROM inv), '6.3a leaving on your own keeps the invite code');
SELECT t.login(:carol);
SELECT t.ok((SELECT count(*) FROM public.retro_boards WHERE slug = 'org-private-retro' AND author_id = auth.uid()) = 1, '6.4 a former member still reads the organization board they authored');

-- transfer ownership, then the previous owner can leave
SELECT t.login(:alice);
SELECT public.set_organization_member_role((SELECT acme FROM ids), :bob, 'owner');
SELECT public.remove_organization_member((SELECT acme FROM ids), :alice);
SELECT t.ok(public.org_role((SELECT acme FROM ids)) IS NULL, '6.5 an owner leaves once another owner exists');

-- ===========================================================================
-- 7. Owner invariant under account deletion
-- ===========================================================================
RESET ROLE;
INSERT INTO public.organization_members (org_id, user_id, role, joined_at) VALUES
  ((SELECT acme FROM ids), :carol, 'member', now() - interval '2 days'),
  ((SELECT acme FROM ids), :dave, 'admin', now() - interval '1 day');
DELETE FROM auth.users WHERE id = :bob;   -- the only owner disappears
SELECT t.ok((SELECT role FROM public.organization_members WHERE org_id = (SELECT acme FROM ids) AND user_id = :dave) = 'owner', '7.1 when the last owner account is deleted an admin inherits ownership');
DELETE FROM auth.users WHERE id = :dave;
SELECT t.ok((SELECT role FROM public.organization_members WHERE org_id = (SELECT acme FROM ids) AND user_id = :carol) = 'owner', '7.2 with no admin left, the longest-standing member inherits');
DELETE FROM public.organization_members WHERE org_id = (SELECT acme FROM ids);
SELECT t.ok((SELECT count(*) FROM public.organizations WHERE id = (SELECT acme FROM ids)) = 0, '7.3 an organization with no members is removed');
SELECT t.ok((SELECT count(*) FROM public.retro_boards WHERE slug = 'org-private-retro' AND org_id IS NULL) = 1, '7.4 its sessions survive and return to their authors');

-- ===========================================================================
-- 8. Deleting an organization
-- ===========================================================================
SELECT t.login(:alice);
CREATE TEMP TABLE del AS SELECT id FROM public.create_organization('Delete Me');
GRANT SELECT ON del TO authenticated;
INSERT INTO public.poker_sessions (slug, title, author_id, author_name, org_id)
VALUES ('doomed-org-poker', 'Doomed', auth.uid(), 'Alice', (SELECT id FROM del));
SELECT public.delete_organization((SELECT id FROM del));
SELECT t.ok((SELECT count(*) FROM public.organizations WHERE id = (SELECT id FROM del)) = 0, '8.1 owner deletes the organization');
SELECT t.ok((SELECT org_id IS NULL FROM public.poker_sessions WHERE slug = 'doomed-org-poker'), '8.2 sessions are detached, not deleted');
RESET ROLE;
INSERT INTO public.organizations (id, slug, name) VALUES ('33333333-3333-4333-8333-333333333333', 'keep-participants', 'Keep');
INSERT INTO public.organization_members (org_id, user_id, role) VALUES ('33333333-3333-4333-8333-333333333333', :alice, 'owner'), ('33333333-3333-4333-8333-333333333333', :carol, 'member');
INSERT INTO public.retro_boards (id, slug, title, author_id, author_name, is_public, org_id) VALUES ('44444444-4444-4444-8444-444444444444', 'keep-private', 'Keep private', :alice, 'Alice', false, '33333333-3333-4333-8333-333333333333');
INSERT INTO public.retro_participants (board_id, user_id, username) VALUES ('44444444-4444-4444-8444-444444444444', :carol, 'Carol');
SELECT t.login(:alice);
SELECT public.delete_organization('33333333-3333-4333-8333-333333333333');
SELECT t.login(:carol);
SELECT t.ok((SELECT count(*) FROM public.retro_boards WHERE slug = 'keep-private') = 1, '8.3 deleting an organization does not evict participants from its former private sessions');

-- ===========================================================================
-- 9. Guest merge
-- ===========================================================================
RESET ROLE;
INSERT INTO auth.users (id, instance_id, aud, role, is_anonymous, raw_user_meta_data)
VALUES ('b0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', false, '{"display_name":"Bob"}');
INSERT INTO public.organizations (id, slug, name, created_by) VALUES
  ('11111111-1111-4111-8111-111111111111', 'merge-one', 'Merge One', :gus),
  ('22222222-2222-4222-8222-222222222222', 'merge-two', 'Merge Two', :gus);
INSERT INTO public.organization_members (org_id, user_id, role, joined_at) VALUES
  ('11111111-1111-4111-8111-111111111111', :gus, 'owner', now() - interval '5 days'),   -- only owner, target not a member
  ('22222222-2222-4222-8222-222222222222', :gus, 'admin', now() - interval '5 days'),   -- both are members
  ('22222222-2222-4222-8222-222222222222', :bob, 'member', now() - interval '1 day'),
  ('22222222-2222-4222-8222-222222222222', :alice, 'owner', now() - interval '9 days');
INSERT INTO public.organization_invites (org_id, code, created_by) VALUES ('11111111-1111-4111-8111-111111111111', 'abcdefghijklmnopqrstuv', :gus);
INSERT INTO public.retro_boards (slug, title, author_id, author_name, org_id) VALUES ('gus-org-board', 'Gus org board', :gus, 'Gus', '11111111-1111-4111-8111-111111111111');

SELECT t.login(:alice);
SELECT t.throws(format($$SELECT public.merge_guest_account_into_current_user(%L, %L)$$, 'f0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001'), 'permission denied', '9.1 an API user cannot call the merge');

RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET LOCAL ROLE service_role;
SELECT public.merge_guest_account_into_current_user(:gus, :bob);
RESET ROLE;
SELECT t.ok((SELECT count(*) FROM public.organization_members WHERE user_id = :gus) = 0, '9.2 merge leaves no membership on the guest');
SELECT t.ok((SELECT role FROM public.organization_members WHERE org_id = '11111111-1111-4111-8111-111111111111' AND user_id = :bob) = 'owner', '9.3 merge moves a sole-owner membership to the target');
SELECT t.ok((SELECT count(*) FROM public.organizations WHERE id = '11111111-1111-4111-8111-111111111111') = 1, '9.4 the organization survives the move (owner repair did not delete it)');
SELECT t.ok((SELECT role FROM public.organization_members WHERE org_id = '22222222-2222-4222-8222-222222222222' AND user_id = :bob) = 'admin', '9.5 on conflict the higher role wins');
SELECT t.ok((SELECT joined_at < now() - interval '4 days' FROM public.organization_members WHERE org_id = '22222222-2222-4222-8222-222222222222' AND user_id = :bob), '9.6 on conflict the earlier join date wins');
SELECT t.ok((SELECT bool_and(created_by = :bob) FROM public.organizations WHERE slug LIKE 'merge-%'), '9.7 merge re-points organizations.created_by');
SELECT t.ok((SELECT created_by = :bob FROM public.organization_invites WHERE org_id = '11111111-1111-4111-8111-111111111111'), '9.8 merge re-points organization_invites.created_by');
SELECT t.ok((SELECT author_id = :bob AND org_id = '11111111-1111-4111-8111-111111111111' FROM public.retro_boards WHERE slug = 'gus-org-board'), '9.9 merge moves an organization board to the target and keeps it in the organization');

-- ===========================================================================
-- Report
-- ===========================================================================
\echo
SELECT CASE WHEN ok THEN 'ok   ' ELSE 'FAIL ' END || label FROM t.results ORDER BY n;
\echo
SELECT count(*) FILTER (WHERE ok) || ' passed, ' || count(*) FILTER (WHERE NOT ok) || ' failed' FROM t.results;

ROLLBACK;
