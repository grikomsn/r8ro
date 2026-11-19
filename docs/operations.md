# Local Development and Operations

## Start

```bash
pnpm install --frozen-lockfile
supabase start
pnpm dev
```

Use Node.js 24 and pnpm 11. Populate `.env.local` with a development Supabase
project; do not commit it.

For a new database, apply every file in `supabase/migrations/` in filename
order. The retro baseline is the first migration in that directory. Enable
anonymous authentication and configure the exact local OAuth callback origin.

## Local Supabase Stack

`supabase start` builds the full local stack: Postgres, GoTrue, PostgREST,
Realtime, Storage, Kong, Studio, and Mailpit. It applies every migration in
`supabase/migrations/` automatically, so the schema is reproducible from a
clean checkout.

`supabase/config.toml` holds the local settings that matter for this app:

- `auth.enable_anonymous_sign_ins = true` — the app signs every visitor in
  anonymously.
- `auth.site_url` and `auth.additional_redirect_urls` — must list the exact
  origin the app runs on, for example `http://localhost:3000`.
- `db.seed.enabled = false` — there is no seed file.

To point the app at the local stack, set `NEXT_PUBLIC_SUPABASE_URL` to
`http://127.0.0.1:54321` and copy the anon and service-role keys printed by
`supabase start`.

`supabase db reset --local` recreates the database and replays all
migrations. Use it after editing a migration.

Local services:

| Service | URL |
| --- | --- |
| API (Kong) | `http://127.0.0.1:54321` |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Studio | `http://127.0.0.1:54323` |
| Mailpit | `http://127.0.0.1:54324` |

## Required Validation

```bash
pnpm fix
pnpm check-types
pnpm build
```

Database checks for organizations and organization-owned sessions run
against the local stack in one transaction that rolls back:

```bash
supabase migration up --local
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -v ON_ERROR_STOP=1 -f supabase/checks/organizations_rls.sql
# expected last line: 131 passed, 0 failed
```

The standalone type check is required because `next.config.mjs` sets
`typescript.ignoreBuildErrors`.

There is no automated browser suite. Realtime changes require two browser
contexts.

## Data Export

Every user can download a JSON archive of the boards and sessions they created
or joined, from the account menu. The export runs in the browser using the
user's own session, so it works until the backing service becomes unavailable,
and it does not depend on the app being reachable.

Take an independent copy of the whole database as well, because the export
only covers what a given user can read. See [Shutdown](#shutdown).

## Shutdown

The hosted Supabase project is being terminated. Before it is deleted:

1. Take a full database dump, including `auth.users` and `auth.identities`,
   and store it outside the project being deleted. Verify that it restores
   into a separate database before relying on it.
2. Announce the shutdown and remind users to export their data. The
   "Export my data" action is the user-facing part of this.
3. Stop creating anonymous accounts and free guest accounts. Deleting an
   `auth.users` row cascades to that user's boards, cards, and votes, because
   every application table references `auth.users` with `ON DELETE CASCADE`.
4. Freeze the application tables before the final dump, and keep the export
   available until the dump is taken:

   ```sql
   REVOKE INSERT, UPDATE, DELETE, TRUNCATE
   ON TABLE
     public.retro_boards,
     public.retro_cards,
     public.retro_participants,
     public.retro_card_votes,
     public.poker_sessions,
     public.poker_participants,
     public.poker_votes,
     public.poker_rounds
   FROM anon, authenticated;

   -- The organization tables have no write grants; they change only
   -- through these functions. The read functions stay available so the
   -- export keeps working.
   REVOKE EXECUTE ON FUNCTION
     public.create_organization(text),
     public.update_organization(uuid, text),
     public.delete_organization(uuid),
     public.set_organization_member_role(uuid, uuid, text),
     public.remove_organization_member(uuid, uuid),
     public.rotate_organization_invite(uuid, integer),
     public.revoke_organization_invite(uuid),
     public.accept_organization_invite(text),
     public.set_session_organization(text, uuid, uuid),
     public.clear_poker_votes(uuid),
     public.complete_poker_round(uuid, text, text)
   FROM authenticated;
   ```

5. Serve a closing page once the project is gone, so visitors get an
   explanation rather than a retry loop.

Anonymous accounts have no password, so restoring them into a different
Supabase project does not restore browser access. Content has to be preserved
through the export and the database dump.

## Manual Smoke Tests

### Retro

1. Create and join a public board in separate contexts.
2. Add, edit, move, delete, and vote on a card.
3. Verify presence, timer, lock, and visibility updates.

### Poker

1. Create and join a public session in separate contexts.
2. Vote, change a vote, reveal, and start or stop voting.
3. Verify presence, story, scale, and visibility updates.

### Organizations

GitHub OAuth is usually not configured locally. To act as a linked user,
mark a local guest as registered and give it a GitHub identity (organizations
require one), then change the display name once in the app so the browser's
session picks it up. Use a different `provider_id` for each user:

```sql
update auth.users set is_anonymous = false where id = '<uid>';
insert into auth.identities
  (provider_id, user_id, identity_data, provider,
   created_at, updated_at, last_sign_in_at)
values
  ('9001', '<uid>', '{"sub":"9001","user_name":"local-dev"}', 'github',
   now(), now(), now());
```

The timestamps are required: the Auth server fails to load a user whose
identity has a null `created_at`.

1. Linked user A creates an organization and an invite link.
2. A guest opens the link: they see the organization and are asked to link
   GitHub, and cannot join.
3. Linked user B joins, sees Sessions and Members, and no invite panel.
4. B creates a private retro in the organization; A opens it without the
   private notice and has host controls; a guest gets "Board not found".
5. A makes B an admin, then an owner; A cannot leave while sole owner.
6. Remove a member who joined a private board; reloading it shows "not
   found" for them.

### Account and Sessions

1. A guest sees "Continue with GitHub" on `/account` and no Sign out.
2. On `/account/sessions`: rename, lock, archive (gone from the landing
   "Yours" list), restore, move into an organization and back, leave, delete.
3. A linked user signs out and lands on `/` as a new guest with no error
   screen.

### Authentication

1. Start with a fresh anonymous session.
2. Link GitHub.
3. Verify the callback returns to the initiating origin.
4. Verify existing session ownership remains available.

## Database Changes

- Add a timestamped migration under `supabase/migrations/`.
- Keep RLS enforcement in SQL.
- Update `docs/data-model/supabase.md` and the relevant feature document.
- For a new realtime table, set `REPLICA IDENTITY FULL` and add it to the
  `supabase_realtime` publication.
