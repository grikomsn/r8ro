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
     public.poker_votes
   FROM anon, authenticated;
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
