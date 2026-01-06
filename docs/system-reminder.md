# Project Operational Notes

Author: autonomous agent
Audience: future agentic contributors
Scope: business logic + setup (frontend/backend)

## Quick Setup
- Install deps: `pnpm install`
- Dev: `pnpm dev`
- Prod build: `pnpm build` → run: `pnpm start`
- Typecheck: `pnpm check-types`
- Format/lint: `pnpm fix` (Ultracite/Biome); direct: `pnpm dlx ultracite check` or `pnpm dlx ultracite fix`
- Tests: none configured; rely on typecheck + build + manual flows
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Cursor & Tooling
- Auto-format hook: `.cursor/hooks.json` runs `pnpm dlx ultracite fix` after file edits
- Supabase MCP: `.cursor/mcp.json` points to project `dpdrtbkckcnedtbuwtiu` at `https://mcp.supabase.com/mcp`

## Tech Stack
- Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4
- shadcn/ui primitives in `components/ui`
- Supabase: auth, realtime, RLS, presence

## Code Style (Biome/Ultracite)
- No semicolons, no trailing commas, prefer double quotes
- Imports: React/Next hooks → external libs → `@/` internals; use `import type` for types; remove unused imports
- Naming: camelCase vars/functions, PascalCase components/types, kebab-case files
- Types: shared in `lib/types.ts`; interfaces for objects, type aliases for unions/primitives; prefer `unknown` over `any`; explicit return types on exports
- Components: function components only; do not nest component definitions; include full hook deps; stable keys (avoid indices)
- Strings & JS: template literals, `const` by default, arrow callbacks, `for...of` over `.forEach()`, optional chaining/nullish coalescing; avoid spread in tight loops
- Errors/logging: use `console.error`; remove `console.log`/`debugger`/`alert`; throw `Error` with messages; prefer early returns
- Async: always `await`; use `async/await` over `.then`; narrow try/catch
- Styling: Tailwind via `className`; use `cn()` helper when merging; prefer shadcn/ui components
- Accessibility: semantic HTML; ARIA labels for icon-only buttons; maintain heading hierarchy; focusable controls; alt text
- Performance: top-level regex literals; avoid redundant recompute in render; consider memoization when warranted; use Next `<Image>` for media
- Framework specifics: use Server Components where appropriate for async data; React 19 passes `ref` as prop (no `forwardRef`)

## Supabase Data & Realtime
- Channels: retro uses `retro-${slug}`, poker uses `poker-${slug}` with presence + `postgres_changes`
- Replication: retro and poker tables set to `REPLICA IDENTITY FULL` and added to publication `supabase_realtime`
- RLS (retro): migration `20260106123000_update_retro_policies.sql` lets participants insert/update/delete cards and votes when boards are unlocked; author retains control when locked. Access uses `auth.uid()`
- Clients: use `createClient` from `lib/supabase/client` for browser contexts
- MCP preferred for DB inspection/changes; add migrations under `supabase/migrations/` and avoid hardcoded IDs

## Business Logic — Retro
- Load: fetch board by slug, cards (with vote counts), participants; upsert current user as participant and mark online. Private boards blocked unless author; join modal when auth lacks display name
- Realtime: board/card/vote/participant subscriptions; presence sync updates `is_online`; visibility/unload handlers update `is_online` and un/track presence
- Locking: `is_locked` disables add/edit/delete/move and voting; author can toggle lock/visibility; delete routes home
- Voting: per-user toggle (insert/delete `retro_card_votes`); counts updated via realtime deltas
- Timer: board-level `timer_running`, `timer_started_at`, `timer_seconds`; author can start/stop/reset/set duration; alarm on zero
- UI notes: `components/retro/retro-column.tsx` gates drag/edit/delete/vote on lock; `RetroPageClient` handles channel lifecycle and optimistic actions

## Business Logic — Poker
- Load: fetch session by slug, participants, votes; upsert user as participant (`is_observer=false`, `is_online=true`). Private sessions blocked unless author; join modal when auth lacks display name
- Realtime: session/participants/votes subscriptions on `poker-${slug}`; presence sync updates `is_online`; visibility/unload handlers keep presence in sync
- Author controls: toggle visibility, start/stop voting (`is_voting_active`), reveal/hide votes (`votes_revealed`), clear votes, edit title/story, change voting scale, delete session
- Voting lifecycle: participants (non-observers) can vote only when voting is active; votes stored per user/session; clearing deletes all votes; reveal shows aggregate stats (min/max/avg/mode) and outliers for numeric scales
- UI notes: `VotingCards` blocks observers or inactive voting; `ParticipantsTable` shows vote visibility rules and stats; `PokerSessionClient` manages realtime and optimistic flows

## Validation Guidance
- Default: run `pnpm check-types`; for integration sanity, run `pnpm build`
- No automated tests; rely on manual browser checks (two-session realtime for retro/poker)
- Before any commit (if asked): run `pnpm fix`; ensure no console noise

## Edge Cases & Pitfalls
- Guard missing auth/user name; show join modal appropriately
- Ensure presence cleanup on unmount and visibility change; avoid duplicate state entries on realtime inserts
- Respect lock state for writes; preserve vote counts on card updates; handle delete navigation back to home

## File/Folder Expectations
- Prefer editing existing files; avoid new files unless needed
- Keep feature logic scoped: retro in `components/retro`, poker in `components/poker`; shared types in `lib/types.ts`

## If You Need Credentials
- Never add secrets; rely on env vars above

## Handoff Checklist
- Typecheck (and build if time)
- Formatting clean (Ultracite auto-run after edits)
- Document remaining gaps or manual steps
