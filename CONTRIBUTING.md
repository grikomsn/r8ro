# Contributing to r8ro

Thank you for helping improve r8ro. By participating, you agree to follow the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Before You Start

- Search existing issues and pull requests.
- Use GitHub Discussions for setup questions.
- Open an issue before investing in a large behavioral or schema change.
- Report vulnerabilities privately according to [SECURITY.md](SECURITY.md).

## Local Setup

Requirements:

- Node.js 24
- pnpm 11
- Git
- A Supabase project or local Supabase stack

```bash
git clone https://github.com/YOUR-USERNAME/r8ro.git
cd r8ro
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Fill `.env.local` with your own Supabase values. Never commit credentials or
production data. See [docs/operations.md](docs/operations.md) for database and
OAuth setup.

## Development Workflow

1. Create a focused branch from `main`.
2. Make the smallest coherent change.
3. Update documentation when behavior, configuration, or schema changes.
4. Run the validation chain.
5. Open a pull request using the repository template.

Use conventional commit prefixes such as `feat:`, `fix:`, `docs:`,
`refactor:`, `test:`, and `chore:`.

## Required Validation

```bash
pnpm fix
pnpm check-types
pnpm build
```

`pnpm build` does not enforce TypeScript errors because the Next.js
configuration ignores them during builds. The standalone type check is
therefore required.

There is currently no automated browser test suite. For realtime changes,
manually verify retro and poker flows in two browser contexts, including
presence, voting, locks, timers, and visibility changes.

## Code Style

The enforced conventions are defined by `biome.jsonc` and summarized in
`AGENTS.md`:

- Semicolons, double quotes, and trailing commas.
- Type-only imports for types and no unused imports.
- External imports before `@/` imports, then relative imports.
- Shared domain types in `lib/types.ts`.
- Accessible semantic controls and labels.
- Explicit Supabase error handling.

Treat `components/ui/**` as vendored shadcn primitives unless the change
specifically updates that layer.

## Database and Realtime Changes

- Add schema changes as timestamped files in `supabase/migrations/`.
- Update `docs/data-model/supabase.md` and the affected feature documentation.
- Keep RLS authoritative; do not replace database checks with client-only
  assumptions.
- For a new realtime table, set `REPLICA IDENTITY FULL` and add it to the
  `supabase_realtime` publication in a new migration.
- Never use production credentials or data in tests, examples, or screenshots.

## Pull Requests

Keep pull requests focused and include:

- What changed and why.
- How the change was validated.
- Screenshots for visible UI changes.
- Migration and RLS notes for database changes.
- Documentation updates or a brief explanation when none are needed.

Maintainers may ask for changes before merging. Passing automation is
necessary but does not replace review or feature-specific manual QA.

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE).
