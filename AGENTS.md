# AGENTS GUIDE (v3)

This file is the contract for agentic coding agents working in this repo.
Keep it short (~150 lines) and keep it accurate.

## 1. Build / Lint / Test

- Package manager: pnpm. If `pnpm` is missing, run `corepack enable` (Node ships Corepack).
- Install deps: `pnpm install`
- Dev server: `pnpm dev`
- Typecheck (required): `pnpm check-types`
- Prod build: `pnpm build`
- Start prod: `pnpm start`

Formatting/linting (Ultracite -> Biome):

- Fix + lint: `pnpm fix`
- Lint only: `pnpm dlx ultracite check`
- Doctor: `pnpm dlx ultracite doctor`

Scoped runs (useful replacement for "run a single test"):

- Fix one file: `pnpm fix -- path/to/file.tsx`
- Lint one file: `pnpm dlx ultracite check path/to/file.tsx`
- Fix a few files: `pnpm dlx ultracite fix "app/retro/[slug]/RetroPageClient.tsx" components/retro/retro-column.tsx`

Tests:

- No Jest/Vitest/Playwright/Cypress configured.
- There is no "run a single test" command.
- Use `pnpm check-types`, `pnpm dlx ultracite check`, `pnpm build`, plus manual QA.

Important: `next.config.mjs` sets `typescript.ignoreBuildErrors: true`.
`pnpm build` will NOT fail on type errors, so `pnpm check-types` is mandatory.

## 2. Repo Map

- `app/` - Next.js 16 App Router (server components + route handlers)
- `app/retro/[slug]/RetroPageClient.tsx` - retro realtime client orchestrator
- `app/poker/[slug]/PokerSessionClient.tsx` - poker realtime client orchestrator
- `components/retro/` and `components/poker/` - feature modules
- `components/ui/` - shadcn/ui primitives (lint disabled; treat as vendor)
- `hooks/` - shared hooks (notably `hooks/use-auth.ts`)
- `lib/` - Supabase clients, shared types, helpers (`@/*` path alias)
- `supabase/` - schema, migrations, RLS docs
- `docs/` - product + operations docs (source of truth)

## 3. Cursor / Copilot Rules

- Cursor hooks: `.cursor/hooks.json` runs `pnpm dlx ultracite fix` after edits.
- Cursor MCP: `.cursor/mcp.json` is a template; set the Supabase `project_ref` (see `docs/operations.md`).
- `.cursor/plans/*` are historical; do not treat as active instructions.
- No `.cursor/rules/` and no `.cursorrules` in this repo.
- No `.github/copilot-instructions.md` in this repo.

## 4. Formatting, Lint, Imports

- Formatter is source of truth; do not hand-format.
- Expected formatting: no semicolons; prefer double quotes; keep diffs minimal.
- Biome config: `biome.jsonc` extends Ultracite presets; some a11y/style rules are disabled.
- `components/ui/**/*` has linter disabled by config (vendor-like).

Import conventions:

- Order groups with one blank line between them:
  1. React/Next
  2. external packages
  3. `@/` absolute imports
  4. relative imports
- Use `import type { ... }` for type-only imports.
- Remove unused imports immediately.

## 5. TypeScript & Types

- `tsconfig.json` is `strict: true`.
- Prefer `unknown` over `any`; narrow with `instanceof Error` or type guards.
- Put shared domain types in `lib/types.ts` (especially DB row shapes).
- Use local interfaces for component props/state only when they are not reused.
- Prefer discriminated unions + `as const` for enums/options.

## 6. Naming, Files, Exports

- Components/types: PascalCase.
- Variables/functions: camelCase.
- Feature component files: kebab-case under `components/**` (existing convention).
- Next route files follow Next conventions (`page.tsx`, `layout.tsx`, `route.ts`).
- Orchestrator clients in `app/**` use PascalCase filenames (existing).
- Exported functions/hooks should have explicit return types when non-trivial.

## 7. React / Next.js Practices

- Default to Server Components; add "use client" only when needed.
- Never declare components inside other components.
- Hooks at top level only; no conditional hooks; complete dependency arrays.
- Keep state immutable; prefer `setX((prev) => ...)`.
- When handling realtime events, dedupe by stable `id` and merge updates without resetting derived fields.
- Prefer `Promise.all` for independent async work.

## 8. Error Handling & Logging

- Supabase calls return `{ data, error }`:
  - Always handle `error` for mutations.
  - For reads that gate navigation/permissions, handle errors explicitly.
- Prefer user-facing errors (inline message/toast) over silent failures.
- Logging rules: `console.error` is ok; do not ship `console.log`, `debugger`, or `alert`.
- Use `try/catch` when multiple awaits must be treated as one failure unit.

## 9. Styling / UI

- Tailwind CSS v4 is configured via `app/globals.css` + `postcss.config.mjs`.
- Use `className` + `cn()` from `lib/utils.ts` for conditional classes.
- Prefer shadcn/ui primitives (`components/ui/`) over bespoke controls.
- Keep the established design language (warm palette, rounded corners, fonts in `app/globals.css`).
- Accessibility: semantic elements, label icon-only buttons (`aria-label`), keep focus-visible states.

## 10. Supabase / Realtime Playbook

- Browser client: `lib/supabase/client.ts` (`createClient()` singleton; clears corrupted tokens).
- Server client: `lib/supabase/server.ts`.
- Middleware helper: `lib/supabase/proxy.ts`.
- Realtime channels: `retro-${slug}` and `poker-${slug}` (presence + `postgres_changes`).
- Always clean up: unsubscribe on unmount; untrack presence on cleanup.
- Respect RLS as source of truth; UI must not bypass locks/visibility.
- When adding tables that need realtime:
  - set `REPLICA IDENTITY FULL`
  - add table to publication `supabase_realtime`
  - mirror `supabase/migrations/20260106120000_enable_realtime_replication.sql`

## 11. Manual QA Checklist (since there are no tests)

- Retro: open the same board in two windows; verify cards insert/update/delete, voting counts, participants online/offline.
- Retro: verify lock/unlock, public/private toggles, and timer start/stop/reset propagate.
- Poker: open the same session in two windows; verify join, vote, reveal/hide, clear votes, observer mode.
- Refresh a tab mid-session; ensure auth persists and presence recovers.

## 12. Docs, Migrations, Hand-off

- Any schema/policy change: add a migration under `supabase/migrations/` and update `docs/data-model/supabase.md`.
- Behavior change: update `docs/features/*.md` and/or `docs/operations.md`.
- Before handing off (or before a commit): run `pnpm fix` + `pnpm check-types` + `pnpm build`.
- Never commit secrets; required env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## 13. Git & Workspace Hygiene

- Default branch: `main`.
- Do not commit unless the user explicitly asks.
- Never change git config.
- Do not run destructive git commands (`reset --hard`, `push --force`, rewriting history) without explicit approval.
- Keep diffs minimal and scoped to the requested change; do not "drive-by" refactors in unrelated areas.

## 14. Practical Conventions

- Env files: prefer `.env.local` (do not commit it); see `.env.example` if present.
- Supabase auth: anonymous-first; avoid flows that require login before basic navigation.
- Route handlers live under `app/**/route.ts`; keep them server-only (no `"use client"`).
- Lint rule overrides exist (see `biome.jsonc`); even if a rule is disabled, follow the spirit (e.g. avoid array-index keys unless truly static).

## 15. Common Gotchas

- If types feel "fine" but runtime is broken: still run `pnpm check-types` (build ignores TS errors).
- If auth gets stuck (user_not_found / sub claim issues): the app proactively clears corrupted Supabase tokens in `lib/supabase/client.ts`.
- Do not import `next/headers` / server-only modules into client components.
- Realtime updates must merge into existing state (dedupe by `id`); do not wipe derived fields like vote counts.
- Prefer stable keys in lists even though `noArrayIndexKey` is disabled.
