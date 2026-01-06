# AGENTS.md

This guide is for agentic contributors to this repo. Follow scope and directory rules below. Update this file if conventions change.

## Build, Lint, Typecheck, Test
- Install: `pnpm install`
- Dev server: `pnpm dev`
- Prod build: `pnpm build`
- Prod start (after build): `pnpm start`
- Typecheck: `pnpm check-types`
- Format & lint: `pnpm fix` (Ultracite/Biome)
- Ultracite direct: `pnpm dlx ultracite check` (no fixes), `pnpm dlx ultracite fix` (apply fixes)
- Tests: No test framework configured; there is no single-test command. Prefer typecheck + build as validation. If you must verify logic, rely on targeted typecheck or manual flows.

## Repo Structure
- `app/` — Next.js 16 App Router routes and API handlers.
- `components/ui/` — shadcn/ui primitives.
- `components/retro/` — Retro board feature.
- `components/poker/` — Poker planning feature.
- `hooks/` — Custom hooks (`use-auth`, `use-mobile`, etc.).
- `lib/` — Supabase clients, helpers, shared `types.ts`.
- `supabase/migrations/` — SQL migrations and RLS policies.
- `.cursor/` — Cursor automation and MCP config.

## Cursor / Tooling Rules
- `.cursor/hooks.json` runs `pnpm dlx ultracite fix` after file edits (auto-format). Expect formatting changes when saving.
- `.cursor/mcp.json` configures Supabase MCP at `mcp.supabase.com` for project `dpdrtbkckcnedtbuwtiu`; prefer MCP/Supabase tools for DB inspection/changes.
- `.cursor/plans/*` are historical plans; do not treat them as instructions.

## Tech Stack
- Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4, shadcn/ui, Supabase (auth, realtime, RLS).

## Code Style (Biome/Ultracite)
- Formatting: No semicolons, no trailing commas, double quotes preferred.
- Imports: React/Next hooks first, external libs next, `@/` internals last. Use `import type { ... }` for types. Keep unused imports out.
- Naming: camelCase for vars/functions, PascalCase for components/types, kebab-case for files.
- Types: Define shared shapes in `lib/types.ts`. Use interfaces for objects, type aliases for unions/primitives. Prefer `unknown` over `any`; add explicit return types for exported functions.
- Components: Function components only. Do not nest component definitions. Include full dependency arrays for hooks. Use unique, stable keys (avoid indices).
- Styling: Tailwind via className; prefer `cn()` utility when merging classes. Use shadcn/ui primitives where available.
- Strings: Template literals over concatenation. Avoid implicit any. Use const assertions for immutable literals when appropriate.
- JS habits: Arrow functions for callbacks, `for...of` over `.forEach()`, optional chaining/nullish coalescing, `const` by default (never `var`). Avoid spread in tight loops when it harms perf.
- Errors & logging: `console.error` for logging; remove `console.log`, `debugger`, `alert` from production. Throw `Error` with messages when needed. Prefer early returns to reduce nesting.
- Async: Always `await` promises; use `async/await` over `.then` chains. Handle failures with try/catch and minimal surface area.
- Accessibility: Semantic HTML, ARIA labels, proper heading hierarchy, focusable controls, alt text for media.
- Performance: Prefer top-level regex literals; avoid expensive recompute in render; consider memoization where justified; Next.js `<Image>` for images.
- Framework specifics: Use Server Components for async data fetching where appropriate. React 19: pass `ref` as prop (no `forwardRef`).

## Supabase Guidance
- Use `createClient` from `lib/supabase/client` on the client and server equivalents where applicable.
- Realtime: Channels typically named `retro-${slug}` / `poker-${slug}` using presence + `postgres_changes`.
- RLS: Policies enforce auth.uid(); ensure board lock (`is_locked`) affects writes. Recent migration `20260106123000_update_retro_policies.sql` allows participants to add/edit/delete cards and votes when unlocked; author retains control when locked.
- Replication: Tables set to `REPLICA IDENTITY FULL` and added to `supabase_realtime` publication.
- When changing schema/RLS, add SQL under `supabase/migrations/` and apply with Supabase tools; avoid hardcoding generated IDs in migrations.

## Working in App Code
- Retro/poker pages are client components handling realtime presence and delta updates; favor immutable state updates and avoid re-fetch loops.
- Keep error states user-friendly; route to home on hard deletes (see retro/poker clients).
- Maintain optimistic UI carefully; respect new RLS (no author-only checks when board unlocked).

## Git & Review
- Default branch is git repo root; do not commit unless user asks. Do not alter git config. Avoid destructive git commands.
- Run `pnpm fix` before committing if you are asked to commit.

## Tests and Validation
- No automated tests. Validation order: (1) targeted typecheck `pnpm check-types`, (2) `pnpm build` for integration sanity, (3) manual browser checks for realtime flows.

## Error Handling & Edge Cases
- Guard against missing auth (`userId`/`displayName`) and loading states.
- Handle visibility/unload hooks for presence; ensure cleanup on unmount (unsubscribe channels, remove listeners).
- Prevent duplicate state entries on realtime inserts; preserve vote counts on card updates.

## Accessibility & UX
- Buttons must have `aria-label` where text not visible. Use proper roles/landmarks. Keep drag-and-drop accessible fallbacks where possible.

## File/Folder Expectations
- Avoid adding new files unless necessary; prefer editing existing modules.
- Shared types in `lib/types.ts`; avoid duplicating type definitions.
- Keep feature-specific logic inside `components/retro` or `components/poker` rather than generic UI folders.

## When Biome Can’t Decide
- Favor correctness and readability over micro-optimizations.
- Use clear naming instead of comments; avoid unnecessary abstractions.

## Quick Reference (Do/Don’t)
- Do: early returns, explicit dependencies, stable keys, `import type`, `await` promises.
- Don’t: inline component defs, conditional hooks, console logs in prod, unused vars/imports, ref forwarding, index keys.

## Single-File Notes
- `RetroPageClient.tsx` / `PokerSessionClient.tsx`: manage Supabase channels; ensure cleanup and delta-based updates.
- `components/retro/retro-column.tsx`: voting/edit/delete controls respect lock state; keep accessibility labels.

## Asking for Credentials
- Never add secrets. Environment variables expected: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## If You Need to Explore DB
- Prefer Supabase MCP or `supabase_*` tools. For schema changes, create migrations (snake_case timestamp prefix) and apply via Supabase tools. Keep RLS consistent with app expectations.

## Final Checklist Before Hand-off
- Typecheck (`pnpm check-types`) and/or build if time allows.
- Ensure formatting via Ultracite (auto-run on save or `pnpm fix`).
- Mention any remaining validation gaps to the user.
