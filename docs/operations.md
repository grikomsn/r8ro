# Local Development and Operations

## Start

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Use Node.js 24 and pnpm 11. Populate `.env.local` with a development Supabase
project; do not commit it.

For a new database, apply `supabase/schema.sql` followed by every migration in
filename order. Enable anonymous authentication and configure the exact local
OAuth callback origin.

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
