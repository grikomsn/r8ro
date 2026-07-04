# Operations and Local Development

## Requirements

- Node.js 24
- pnpm 11
- Git
- A Supabase project or local Supabase CLI stack

## Start the App

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Set the required Supabase variables in `.env.local`. The service-role key is
also required when exercising the guest-to-GitHub merge fallback. Never use
production credentials for contributor testing.

## Database Setup

For a fresh hosted or local database:

1. Apply `supabase/schema.sql`.
2. Apply every file in `supabase/migrations/` in filename order.
3. Enable anonymous authentication.
4. Configure exact local and production OAuth callback URLs.

For a local Supabase CLI stack:

```bash
supabase init
supabase start
```

Use the local database connection details printed by `supabase status` to
apply the schema and migrations. Do not commit generated files under
`supabase/.temp/`.

The checked-in `.cursor/mcp.json` contains a placeholder project reference.
Replace it only in a local, ignored override; repository documentation and
configuration must not identify the production Supabase project.

## Schema Changes

- Add every change as a timestamped file in `supabase/migrations/`.
- Update `docs/data-model/supabase.md` and affected feature docs.
- Keep `supabase/schema.sql` as the fresh-project retro baseline.
- For new realtime tables, set `REPLICA IDENTITY FULL` and add the table to the
  `supabase_realtime` publication in a new migration.
- Review RLS for every new table and operation.

## Validation

Run the full handoff chain:

```bash
pnpm fix
pnpm check-types
pnpm build
```

The Next.js build is configured to ignore TypeScript build errors, so
`pnpm check-types` is independently required.

No automated browser suite is configured. Use two browser contexts for
realtime smoke tests.

### Retro Smoke Test

1. Create a board as a guest.
2. Join it from another browser context.
3. Add, edit, move, vote on, and delete a card.
4. Verify presence and timer updates in both contexts.
5. Verify public, private, and locked behavior.

### Poker Smoke Test

1. Create a poker session.
2. Join from another context as a participant or observer.
3. Vote, reveal, clear, and restart voting.
4. Verify presence, visibility, and author-only controls.

### Authentication Smoke Test

1. Start as an anonymous guest.
2. Link the guest to GitHub.
3. Confirm the callback returns to the original origin.
4. Confirm existing boards and sessions remain associated with the account.

## Documentation

- `docs/features/retro.md` and `docs/features/poker.md` describe feature
  behavior.
- `docs/data-model/supabase.md` describes schema and RLS.
- `docs/deployment.md` covers Supabase and Vercel configuration.
- `AGENTS.md` is the concise repository contract for automated contributors.
