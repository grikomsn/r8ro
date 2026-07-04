# r8ro

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/grikomsn/r8ro/actions/workflows/ci.yml/badge.svg)](https://github.com/grikomsn/r8ro/actions/workflows/ci.yml)
[![Secret scan](https://github.com/grikomsn/r8ro/actions/workflows/secret-scan.yml/badge.svg)](https://github.com/grikomsn/r8ro/actions/workflows/secret-scan.yml)

Realtime retrospective boards and planning poker built with Next.js and
Supabase. The deployed app is [r8ro.app](https://r8ro.app).

![Retro board with cards](docs/images/board-with-content.png)

## Current Features

### Retrospectives

- Three columns: Went Well, To Improve, and Action Items.
- Realtime cards, votes, participants, and presence.
- Shared timer and recent-board history.
- Author controls for title, visibility, lock state, and deletion.
- Unlocked boards let participants add, edit, move, delete, and vote on cards.
- Locked boards leave those mutations to the board author.

### Planning Poker

- Fibonacci, T-shirt, and linear voting scales.
- Realtime participants, votes, and presence.
- Author controls for title, story, visibility, voting state, vote reveal, and
  scale.
- Numeric vote statistics after reveal.

Every visitor signs in through Supabase anonymous authentication. An anonymous
account can optionally be linked to GitHub. The current UI restricts private
boards and poker sessions to their author.

## Stack

- Next.js 16 and React 19
- TypeScript
- Tailwind CSS 4 and shadcn/ui
- Supabase Auth, PostgreSQL, Row Level Security, and Realtime
- Vercel

## Local Setup

Requirements:

- Node.js 24
- pnpm 11
- A Supabase project or local Supabase stack

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Set these values in `.env.local`:

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser-safe anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | For GitHub merge fallback | Server only |
| `AUTH_LINK_COOKIE_SECRET` | No | Server-only HMAC secret; falls back to the service-role key |

Never expose a service-role key through a `NEXT_PUBLIC_` variable.

For a new database, apply `supabase/schema.sql`, then every file in
`supabase/migrations/` in filename order. Enable anonymous authentication and
configure the callback URLs described in
[docs/deployment.md](docs/deployment.md).

## Validation

```bash
pnpm fix
pnpm check-types
pnpm build
```

`pnpm check-types` is required because the Next.js build is configured to skip
TypeScript errors.

## Documentation

- [Architecture overview](docs/overview.md)
- [Retro behavior](docs/features/retro.md)
- [Poker behavior](docs/features/poker.md)
- [Supabase data model and RLS](docs/data-model/supabase.md)
- [Operations](docs/operations.md)
- [Deployment](docs/deployment.md)

See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request and
[SECURITY.md](SECURITY.md) for private vulnerability reporting.

## License

[MIT](LICENSE)
