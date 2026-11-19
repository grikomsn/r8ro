-- Organizations: named groups of GitHub-linked accounts.
--
-- An organization has members with one of three roles:
--
--   owner   everything, including roles, ownership and deleting the
--           organization
--   admin   rename the organization, manage the invite link, remove plain
--           members, and manage the organization's sessions
--   member  see the organization, its members and its sessions, and create
--           sessions in it
--
-- Guest (anonymous) accounts cannot create or join an organization. A guest
-- identity lives in one browser and is lost with its storage, so a guest
-- owner would orphan the organization and a guest member could never be
-- re-identified. Guests still join an organization's sessions by link.
--
-- The three tables are read-only for API roles. Every write goes through a
-- SECURITY DEFINER function that checks the caller's role itself, so there
-- are no INSERT, UPDATE or DELETE policies whose WITH CHECK could be used to
-- escalate a role.
--
-- The membership checks used by RLS are SECURITY DEFINER helpers. A policy on
-- organization_members that queried organization_members directly would
-- recurse.
--
-- None of these tables is added to the realtime publication. The
-- organization pages read on load and after each change.

BEGIN;

SET LOCAL lock_timeout = '3s';

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizations_slug_key UNIQUE (slug),
  CONSTRAINT organizations_slug_format CHECK (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    AND char_length(slug) BETWEEN 2 AND 48
  ),
  -- /orgs/new and /orgs/join are application routes.
  CONSTRAINT organizations_slug_reserved CHECK (slug NOT IN ('new', 'join')),
  CONSTRAINT organizations_name_length CHECK (
    char_length(name) BETWEEN 1 AND 80
    AND name = btrim(name)
  )
);

CREATE TABLE IF NOT EXISTS public.organization_members (
  org_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_members_pkey PRIMARY KEY (org_id, user_id),
  CONSTRAINT organization_members_role_check CHECK (
    role IN ('owner', 'admin', 'member')
  )
);

CREATE INDEX IF NOT EXISTS organization_members_user_id_idx
  ON public.organization_members (user_id);

-- One invite link per organization. No row means invites are switched off.
-- It is a separate table so that only owners and admins can read the code.
CREATE TABLE IF NOT EXISTS public.organization_invites (
  org_id uuid PRIMARY KEY
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- NULL means the link does not expire.
  expires_at timestamptz,
  CONSTRAINT organization_invites_code_key UNIQUE (code),
  CONSTRAINT organization_invites_code_format CHECK (
    code ~ '^[A-Za-z0-9_-]{20,64}$'
  )
);

-- ============================================================================
-- HELPERS USED BY RLS
-- ============================================================================

-- True for a signed-in account that is not a guest. auth.users is read
-- instead of the JWT claim so that the answer is correct immediately after a
-- guest links GitHub, before the access token is refreshed.
CREATE OR REPLACE FUNCTION public.is_registered_user()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  -- A GitHub identity, not merely "not anonymous": an account registered
  -- some other way (for example by email through the Auth API) has no
  -- verified handle for fellow members to check.
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN auth.identities i
      ON i.user_id = u.id
     AND i.provider = 'github'
    WHERE u.id = (SELECT auth.uid())
      AND u.is_anonymous IS NOT TRUE
  );
$$;

-- The caller's role in an organization, or NULL when they are not a member.
CREATE OR REPLACE FUNCTION public.org_role(p_org_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT m.role
  FROM public.organization_members m
  WHERE m.org_id = p_org_id
    AND m.user_id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members m
    WHERE m.org_id = p_org_id
      AND m.user_id = (SELECT auth.uid())
  );
$$;

-- Owners and admins manage the organization's sessions and its invite link.
CREATE OR REPLACE FUNCTION public.is_org_manager(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members m
    WHERE m.org_id = p_org_id
      AND m.user_id = (SELECT auth.uid())
      AND m.role IN ('owner', 'admin')
  );
$$;

ALTER FUNCTION public.is_registered_user() OWNER TO postgres;
ALTER FUNCTION public.org_role(uuid) OWNER TO postgres;
ALTER FUNCTION public.is_org_member(uuid) OWNER TO postgres;
ALTER FUNCTION public.is_org_manager(uuid) OWNER TO postgres;

-- is_org_member and is_org_manager are referenced by policies on
-- retro_boards and poker_sessions, which the anon role may select from for
-- server-rendered metadata. EXECUTE is checked when the policy expression is
-- initialised, so anon needs it even though the functions return false for it.
REVOKE ALL ON FUNCTION public.is_registered_user() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.org_role(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_org_manager(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_registered_user()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.org_role(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_manager(uuid)
  TO anon, authenticated, service_role;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizations_select_member ON public.organizations;

CREATE POLICY organizations_select_member
ON public.organizations
FOR SELECT
TO authenticated
USING (public.is_org_member(id));

DROP POLICY IF EXISTS organization_members_select_member
ON public.organization_members;

CREATE POLICY organization_members_select_member
ON public.organization_members
FOR SELECT
TO authenticated
USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS organization_invites_select_manager
ON public.organization_invites;

CREATE POLICY organization_invites_select_manager
ON public.organization_invites
FOR SELECT
TO authenticated
USING (public.is_org_manager(org_id));

-- There are deliberately no INSERT, UPDATE or DELETE policies.

REVOKE ALL PRIVILEGES ON TABLE
  public.organizations,
  public.organization_members,
  public.organization_invites
FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON TABLE
  public.organizations,
  public.organization_members,
  public.organization_invites
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.organizations,
  public.organization_members,
  public.organization_invites
TO service_role;

-- ============================================================================
-- OWNER INVARIANT
-- ============================================================================

-- The functions below refuse to remove or demote the last owner. A membership
-- can still disappear without them, when an auth.users row is deleted and the
-- delete cascades. This trigger repairs that case: the longest-standing admin
-- (or, failing that, member) becomes the owner, and an organization with no
-- members left is deleted. Its sessions go back to their authors because
-- org_id is ON DELETE SET NULL.
CREATE OR REPLACE FUNCTION public.ensure_organization_has_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  heir_id uuid;
BEGIN
  -- Nothing to repair while the organization itself is being deleted.
  PERFORM 1
  FROM public.organizations o
  WHERE o.id = OLD.org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.organization_members m
    WHERE m.org_id = OLD.org_id
      AND m.role = 'owner'
  ) THEN
    RETURN NULL;
  END IF;

  SELECT m.user_id
  INTO heir_id
  FROM public.organization_members m
  WHERE m.org_id = OLD.org_id
  ORDER BY (m.role = 'admin') DESC, m.joined_at, m.user_id
  LIMIT 1;

  IF heir_id IS NULL THEN
    DELETE FROM public.organizations WHERE id = OLD.org_id;
  ELSE
    UPDATE public.organization_members
    SET role = 'owner'
    WHERE org_id = OLD.org_id
      AND user_id = heir_id;
  END IF;

  RETURN NULL;
END;
$$;

ALTER FUNCTION public.ensure_organization_has_owner() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.ensure_organization_has_owner()
FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS organization_members_keep_owner
ON public.organization_members;

CREATE TRIGGER organization_members_keep_owner
AFTER DELETE ON public.organization_members
FOR EACH ROW
EXECUTE FUNCTION public.ensure_organization_has_owner();

-- ============================================================================
-- WRITE FUNCTIONS
-- ============================================================================

-- Creates an organization and makes the caller its owner. The slug is derived
-- from the name; a numeric suffix is added when it is taken, reserved or too
-- short (for example a name with no Latin letters).
CREATE OR REPLACE FUNCTION public.create_organization(p_name text)
RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  clean_name text :=
    btrim(regexp_replace(COALESCE(p_name, ''), '\s+', ' ', 'g'));
  base_slug text;
  candidate text;
  needs_suffix boolean;
  created public.organizations%ROWTYPE;
  attempt integer;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_registered_user() THEN
    RAISE EXCEPTION 'Link a GitHub account to create an organization'
      USING ERRCODE = '42501';
  END IF;

  IF clean_name = '' OR char_length(clean_name) > 80 THEN
    RAISE EXCEPTION 'Organization name must be between 1 and 80 characters'
      USING ERRCODE = '22023';
  END IF;

  IF (
    SELECT count(*)
    FROM public.organization_members m
    WHERE m.user_id = caller_id
  ) >= 50 THEN
    RAISE EXCEPTION 'You can belong to at most 50 organizations'
      USING ERRCODE = '54000';
  END IF;

  base_slug := btrim(
    left(
      btrim(regexp_replace(lower(clean_name), '[^a-z0-9]+', '-', 'g'), '-'),
      40
    ),
    '-'
  );

  needs_suffix :=
    char_length(base_slug) < 2 OR base_slug IN ('new', 'join');

  IF char_length(base_slug) < 2 THEN
    base_slug := 'team';
  END IF;

  FOR attempt IN 1..8 LOOP
    candidate := CASE
      WHEN attempt = 1 AND NOT needs_suffix THEN base_slug
      ELSE base_slug || '-' || lpad(floor(random() * 10000)::integer::text, 4, '0')
    END;

    BEGIN
      INSERT INTO public.organizations (slug, name, created_by)
      VALUES (candidate, clean_name, caller_id)
      RETURNING * INTO created;

      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        IF attempt = 8 THEN
          RAISE EXCEPTION 'Could not find a free address for this organization. Try a different name.'
            USING ERRCODE = '23505';
        END IF;
    END;
  END LOOP;

  INSERT INTO public.organization_members (org_id, user_id, role)
  VALUES (created.id, caller_id, 'owner');

  RETURN created;
END;
$$;

-- Renames an organization. The slug is permanent so that links keep working.
CREATE OR REPLACE FUNCTION public.update_organization(
  p_org_id uuid,
  p_name text
)
RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  clean_name text :=
    btrim(regexp_replace(COALESCE(p_name, ''), '\s+', ' ', 'g'));
  updated public.organizations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_org_manager(p_org_id) THEN
    RAISE EXCEPTION 'Only an owner or admin can rename the organization'
      USING ERRCODE = '42501';
  END IF;

  IF clean_name = '' OR char_length(clean_name) > 80 THEN
    RAISE EXCEPTION 'Organization name must be between 1 and 80 characters'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.organizations
  SET name = clean_name,
      updated_at = now()
  WHERE id = p_org_id
  RETURNING * INTO updated;

  RETURN updated;
END;
$$;

-- Deletes an organization. Its sessions are kept and go back to their
-- authors, because retro_boards.org_id and poker_sessions.org_id are
-- ON DELETE SET NULL.
CREATE OR REPLACE FUNCTION public.delete_organization(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF public.org_role(p_org_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner can delete the organization'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.organizations WHERE id = p_org_id;
END;
$$;

-- Creates the invite link, or replaces it with a new one. The previous code
-- stops working immediately. p_expires_in_days NULL means no expiry.
CREATE OR REPLACE FUNCTION public.rotate_organization_invite(
  p_org_id uuid,
  p_expires_in_days integer DEFAULT 7
)
RETURNS public.organization_invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  invite public.organization_invites%ROWTYPE;
  -- 22 URL-safe characters taken from two random UUIDs: about 126 random
  -- bits, with no dependency on pgcrypto.
  new_code text := translate(
    left(
      encode(
        uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid()),
        'base64'
      ),
      22
    ),
    '+/',
    '-_'
  );
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_org_manager(p_org_id) THEN
    RAISE EXCEPTION 'Only an owner or admin can manage the invite link'
      USING ERRCODE = '42501';
  END IF;

  IF p_expires_in_days IS NOT NULL
     AND p_expires_in_days NOT BETWEEN 1 AND 365 THEN
    RAISE EXCEPTION 'Invite expiry must be between 1 and 365 days'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.organization_invites AS i
    (org_id, code, created_by, created_at, expires_at)
  VALUES (
    p_org_id,
    new_code,
    caller_id,
    now(),
    now() + make_interval(days => p_expires_in_days)
  )
  ON CONFLICT (org_id) DO UPDATE
  SET code = EXCLUDED.code,
      created_by = EXCLUDED.created_by,
      created_at = EXCLUDED.created_at,
      expires_at = EXCLUDED.expires_at
  RETURNING i.* INTO invite;

  RETURN invite;
END;
$$;

-- Switches the invite link off.
CREATE OR REPLACE FUNCTION public.revoke_organization_invite(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_org_manager(p_org_id) THEN
    RAISE EXCEPTION 'Only an owner or admin can manage the invite link'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.organization_invites WHERE org_id = p_org_id;
END;
$$;

-- What the holder of an invite code is being invited to. Guests may call it,
-- so the join page can name the organization before asking them to link
-- GitHub. An unknown code returns no row.
CREATE OR REPLACE FUNCTION public.get_organization_invite(p_code text)
RETURNS TABLE (
  org_id uuid,
  org_slug text,
  org_name text,
  member_count bigint,
  is_member boolean,
  is_expired boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    o.id,
    o.slug,
    o.name,
    (
      SELECT count(*)
      FROM public.organization_members m
      WHERE m.org_id = o.id
    ),
    EXISTS (
      SELECT 1
      FROM public.organization_members m
      WHERE m.org_id = o.id
        AND m.user_id = (SELECT auth.uid())
    ),
    i.expires_at IS NOT NULL AND i.expires_at <= now()
  FROM public.organization_invites i
  JOIN public.organizations o ON o.id = i.org_id
  WHERE (SELECT auth.uid()) IS NOT NULL
    AND i.code = p_code;
$$;

-- Joins the organization behind an invite code as a plain member and returns
-- the organization slug. Joining twice is not an error.
CREATE OR REPLACE FUNCTION public.accept_organization_invite(p_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  invite public.organization_invites%ROWTYPE;
  target_slug text;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_registered_user() THEN
    RAISE EXCEPTION 'Link a GitHub account to join an organization'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO invite
  FROM public.organization_invites i
  WHERE i.code = p_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This invite link is not valid. Ask for a new one.'
      USING ERRCODE = '22023';
  END IF;

  IF invite.expires_at IS NOT NULL AND invite.expires_at <= now() THEN
    RAISE EXCEPTION 'This invite link has expired. Ask for a new one.'
      USING ERRCODE = '22023';
  END IF;

  -- Serialises joins with role changes and removals in the same organization.
  SELECT o.slug
  INTO target_slug
  FROM public.organizations o
  WHERE o.id = invite.org_id
  FOR UPDATE;

  -- Check the code again now that the lock is held. A removal replaces the
  -- code while holding this same lock, so a call that validated the old code
  -- just before a removal must not let the removed member straight back in.
  -- (A single-transaction check script cannot exercise this race.)
  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_invites i
    WHERE i.org_id = invite.org_id
      AND i.code = p_code
      AND (i.expires_at IS NULL OR i.expires_at > now())
  ) THEN
    RAISE EXCEPTION 'This invite link is not valid. Ask for a new one.'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.organization_members m
    WHERE m.org_id = invite.org_id
      AND m.user_id = caller_id
  ) THEN
    RETURN target_slug;
  END IF;

  IF (
    SELECT count(*)
    FROM public.organization_members m
    WHERE m.org_id = invite.org_id
  ) >= 250 THEN
    RAISE EXCEPTION 'This organization is full'
      USING ERRCODE = '54000';
  END IF;

  IF (
    SELECT count(*)
    FROM public.organization_members m
    WHERE m.user_id = caller_id
  ) >= 50 THEN
    RAISE EXCEPTION 'You can belong to at most 50 organizations'
      USING ERRCODE = '54000';
  END IF;

  INSERT INTO public.organization_members (org_id, user_id, role)
  VALUES (invite.org_id, caller_id, 'member')
  ON CONFLICT (org_id, user_id) DO NOTHING;

  RETURN target_slug;
END;
$$;

-- Changes a member's role. Only an owner may, and the last owner cannot be
-- demoted. Making another member an owner is how ownership is transferred.
CREATE OR REPLACE FUNCTION public.set_organization_member_role(
  p_org_id uuid,
  p_user_id uuid,
  p_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_role text;
  target_role text;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF p_role IS NULL OR p_role NOT IN ('owner', 'admin', 'member') THEN
    RAISE EXCEPTION 'Unknown role'
      USING ERRCODE = '22023';
  END IF;

  -- Serialises concurrent role changes so the last-owner check holds.
  PERFORM 1
  FROM public.organizations o
  WHERE o.id = p_org_id
  FOR UPDATE;

  SELECT m.role
  INTO caller_role
  FROM public.organization_members m
  WHERE m.org_id = p_org_id
    AND m.user_id = caller_id;

  IF caller_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner can change roles'
      USING ERRCODE = '42501';
  END IF;

  SELECT m.role
  INTO target_role
  FROM public.organization_members m
  WHERE m.org_id = p_org_id
    AND m.user_id = p_user_id;

  IF target_role IS NULL THEN
    RAISE EXCEPTION 'That person is not a member of this organization'
      USING ERRCODE = '22023';
  END IF;

  IF target_role = p_role THEN
    RETURN;
  END IF;

  IF target_role = 'owner' AND (
    SELECT count(*)
    FROM public.organization_members m
    WHERE m.org_id = p_org_id
      AND m.role = 'owner'
  ) <= 1 THEN
    RAISE EXCEPTION 'An organization needs at least one owner. Make someone else an owner first.'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.organization_members
  SET role = p_role
  WHERE org_id = p_org_id
    AND user_id = p_user_id;
END;
$$;

-- Removes a member, or lets the caller leave.
--
--   anyone  may remove themselves, except the last owner
--   owner   may remove anyone else
--   admin   may remove plain members
CREATE OR REPLACE FUNCTION public.remove_organization_member(
  p_org_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_role text;
  target_role text;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  PERFORM 1
  FROM public.organizations o
  WHERE o.id = p_org_id
  FOR UPDATE;

  SELECT m.role
  INTO caller_role
  FROM public.organization_members m
  WHERE m.org_id = p_org_id
    AND m.user_id = caller_id;

  IF caller_role IS NULL THEN
    RAISE EXCEPTION 'You are not a member of this organization'
      USING ERRCODE = '42501';
  END IF;

  SELECT m.role
  INTO target_role
  FROM public.organization_members m
  WHERE m.org_id = p_org_id
    AND m.user_id = p_user_id;

  IF target_role IS NULL THEN
    RAISE EXCEPTION 'That person is not a member of this organization'
      USING ERRCODE = '22023';
  END IF;

  IF p_user_id = caller_id THEN
    IF target_role = 'owner' AND (
      SELECT count(*)
      FROM public.organization_members m
      WHERE m.org_id = p_org_id
        AND m.role = 'owner'
    ) <= 1 THEN
      RAISE EXCEPTION 'You are the only owner. Make someone else an owner, or delete the organization.'
        USING ERRCODE = '23514';
    END IF;
  ELSIF caller_role = 'owner' THEN
    NULL;
  ELSIF caller_role = 'admin' AND target_role = 'member' THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'You cannot remove this member'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.organization_members
  WHERE org_id = p_org_id
    AND user_id = p_user_id;

  -- A removed member may still hold the invite link and could rejoin at
  -- once. Removing someone therefore replaces the code; the lifetime is
  -- kept. Leaving on your own does not, so you can rejoin with the link.
  IF p_user_id <> caller_id THEN
    UPDATE public.organization_invites
    SET code = translate(
          left(
            encode(
              uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid()),
              'base64'
            ),
            22
          ),
          '+/',
          '-_'
        ),
        created_by = caller_id,
        created_at = now()
    WHERE org_id = p_org_id;
  END IF;
END;
$$;

-- ============================================================================
-- READ FUNCTIONS
-- ============================================================================

-- Members with the profile fields the member list shows. Display names and
-- avatars live in auth.users and auth.identities, which API roles cannot
-- read, so this function exposes exactly those fields to fellow members.
-- E-mail addresses are never returned.
CREATE OR REPLACE FUNCTION public.list_organization_members(p_org_id uuid)
RETURNS TABLE (
  user_id uuid,
  role text,
  joined_at timestamptz,
  display_name text,
  avatar_url text,
  github_username text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'You are not a member of this organization'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    m.user_id,
    m.role,
    m.joined_at,
    COALESCE(
      NULLIF(btrim(u.raw_user_meta_data ->> 'display_name'), ''),
      NULLIF(btrim(gh.identity_data ->> 'user_name'), ''),
      'Member'
    ),
    -- Handle and avatar come from the GitHub identity only. User metadata is
    -- writable by its owner through auth.updateUser, so it could claim any
    -- handle or point every member's browser at an arbitrary image.
    gh.identity_data ->> 'avatar_url',
    gh.identity_data ->> 'user_name'
  FROM public.organization_members m
  JOIN auth.users u ON u.id = m.user_id
  LEFT JOIN LATERAL (
    SELECT i.identity_data
    FROM auth.identities i
    WHERE i.user_id = m.user_id
      AND i.provider = 'github'
    ORDER BY i.created_at
    LIMIT 1
  ) gh ON true
  WHERE m.org_id = p_org_id
  ORDER BY
    CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
    m.joined_at,
    m.user_id;
END;
$$;

-- The caller's organizations with their role and the counts shown in lists.
CREATE OR REPLACE FUNCTION public.list_my_organizations()
RETURNS TABLE (
  id uuid,
  slug text,
  name text,
  role text,
  member_count bigint,
  created_at timestamptz,
  joined_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    o.id,
    o.slug,
    o.name,
    me.role,
    (
      SELECT count(*)
      FROM public.organization_members m
      WHERE m.org_id = o.id
    ),
    o.created_at,
    me.joined_at
  FROM public.organization_members me
  JOIN public.organizations o ON o.id = me.org_id
  WHERE me.user_id = (SELECT auth.uid())
  ORDER BY lower(o.name), o.id;
$$;

-- ============================================================================
-- FUNCTION OWNERSHIP AND GRANTS
-- ============================================================================

ALTER FUNCTION public.create_organization(text) OWNER TO postgres;
ALTER FUNCTION public.update_organization(uuid, text) OWNER TO postgres;
ALTER FUNCTION public.delete_organization(uuid) OWNER TO postgres;
ALTER FUNCTION public.rotate_organization_invite(uuid, integer)
  OWNER TO postgres;
ALTER FUNCTION public.revoke_organization_invite(uuid) OWNER TO postgres;
ALTER FUNCTION public.get_organization_invite(text) OWNER TO postgres;
ALTER FUNCTION public.accept_organization_invite(text) OWNER TO postgres;
ALTER FUNCTION public.set_organization_member_role(uuid, uuid, text)
  OWNER TO postgres;
ALTER FUNCTION public.remove_organization_member(uuid, uuid)
  OWNER TO postgres;
ALTER FUNCTION public.list_organization_members(uuid) OWNER TO postgres;
ALTER FUNCTION public.list_my_organizations() OWNER TO postgres;

REVOKE ALL ON FUNCTION
  public.create_organization(text),
  public.update_organization(uuid, text),
  public.delete_organization(uuid),
  public.rotate_organization_invite(uuid, integer),
  public.revoke_organization_invite(uuid),
  public.get_organization_invite(text),
  public.accept_organization_invite(text),
  public.set_organization_member_role(uuid, uuid, text),
  public.remove_organization_member(uuid, uuid),
  public.list_organization_members(uuid),
  public.list_my_organizations()
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION
  public.create_organization(text),
  public.update_organization(uuid, text),
  public.delete_organization(uuid),
  public.rotate_organization_invite(uuid, integer),
  public.revoke_organization_invite(uuid),
  public.get_organization_invite(text),
  public.accept_organization_invite(text),
  public.set_organization_member_role(uuid, uuid, text),
  public.remove_organization_member(uuid, uuid),
  public.list_organization_members(uuid),
  public.list_my_organizations()
TO authenticated;

COMMIT;
