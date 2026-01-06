# AGENTS GUIDE (v2)

This file is the contract for all agentic contributors. Keep it updated if expectations change. (~150 lines.)

## 1. Build / Lint / Test Essentials
1. `pnpm install` — install dependencies.
2. `pnpm dev` — Next.js dev server with HMR.
3. `pnpm build` — production build (includes type analysis).
4. `pnpm start` — run the production bundle.
5. `pnpm check-types` — strict TypeScript + Next.js validation; run frequently.
6. `pnpm fix` — Biome/Ultracite auto format + lint (also triggered by Cursor hook).
7. `pnpm dlx ultracite check` — lint only, no fixes.
8. `pnpm dlx ultracite fix` — formatter-only invocation when hook misses a file.

> **Single-test command**: Not available. The repo ships without Jest/Vitest, so there is no per-test runner. Validate via `pnpm check-types`, `pnpm build`, and manual browser QA (two-tab realtime checks). Document new test commands here if you add a framework.

## 2. Repo & Tooling Overview
- `app/` — Next.js 16 App Router routes + API handlers (`app/new/route.ts`).
- `components/ui/` — shadcn/ui primitives. `components/retro/` and `components/poker/` contain feature modules.
- `hooks/` — shared hooks such as `use-auth`, `use-mobile`.
- `lib/` — Supabase clients (`lib/supabase/*`), shared `types.ts`, helper utilities.
- `supabase/` — schema dump, migrations, RLS docs.
- `docs/` — authoritative overview, feature, data-model, and operations guides.
- `.cursor/` — automation + MCP config. `hooks.json` auto-runs `pnpm dlx ultracite fix` after edits. `mcp.json` points to Supabase MCP project `dpdrtbkckcnedtbuwtiu`. `.cursor/plans/*` are historical; ignore them as active instructions.
- There are no `.cursor/rules` / `.cursorrules` files and no `.github/copilot-instructions.md` in this repo.

## 3. Code Style (Biome/Ultracite)
- **Formatting**: No semicolons. No trailing commas. Prefer double quotes. Formatter output is source of truth.
- **Imports**: Order groups as (1) React/Next, (2) external packages, (3) `@/` aliases, (4) relative paths. Separate groups with single blank lines. Use `import type { Foo }` for type-only usage. Remove unused imports immediately.
- **Naming**: camelCase vars/functions, PascalCase components/types, kebab-case filenames. Constants use descriptive names; reserve ALL_CAPS for immutable config arrays.
- **Types**: Shared interfaces live in `lib/types.ts`. Interfaces for object shapes, type aliases for unions/primitives. Prefer `unknown` over `any`. Explicit return types for exported functions and hooks.
- **Components**: Function components only. Never declare components inside other components. Hooks must live at the top level. Always provide complete dependency arrays. Keys must be stable (GUIDs or IDs, not indexes unless static).
- **Styling**: Tailwind via `className`. Use `cn()` helper to merge conditional classes. Reach for shadcn/ui primitives before building bespoke controls.
- **Strings**: Template literals for concatenation. Use const assertions (`as const`) for static arrays/objects that become union types.
- **JS habits**: Default to `const`, use `let` when mutation is required. Prefer arrow callbacks. Use optional chaining/nullish coalescing for defensive logic. Avoid `.forEach()` where `await` is necessary; prefer `for...of`.
- **Async**: Write `async/await` exclusively. `try/catch` around Supabase mutations. Propagate actionable errors using `throw new Error("message")` or UI-friendly notifications.
- **Logging**: Production code may use `console.error` for genuine failures but must not contain `console.log`, `debugger`, or `alert`.
- **Performance**: Avoid re-creating expensive objects inside render. Memoize derived data when re-renders are costly. Use top-level regex literals.
- **Accessibility**: Semantic HTML, maintain heading hierarchy, label icon-only controls with `aria-label`, ensure focusable fallbacks for drag-and-drop interactions.
- **Framework**: Favor Server Components for async data fetching when possible. React 19 uses “refs as props”; avoid `forwardRef` unless required by third-party APIs.

## 4. Supabase Playbook
- Use `createClient` (`lib/supabase/client`) in browser contexts; server code should use `lib/supabase/server` or `proxy.ts` helpers.
- Realtime channels follow `retro-${slug}` and `poker-${slug}` patterns with both presence and `postgres_changes`. Always unsubscribe and untrack on cleanup.
- RLS policies depend on `auth.uid()`. Retro lock behavior updated in migration `20260106123000_update_retro_policies.sql` (participants may edit/vote while unlocked). Poker tables + policies defined in `20250101000000_create_poker_tables.sql`; default `is_voting_active` toggled in `20251223151027_alter_poker_sessions_default_voting_active.sql`.
- Replication migration `20260106120000_enable_realtime_replication.sql` sets `REPLICA IDENTITY FULL` and adds tables to publication `supabase_realtime`—mirror this when adding new tables needing realtime.
- Prefer Supabase MCP (`supabase_execute_sql`, etc.) for schema introspection. Update `docs/data-model/supabase.md` whenever migrations change behavior.

## 5. Working in App Code
- `RetroPageClient.tsx` and `PokerSessionClient.tsx` orchestrate data fetching, presence tracking, realtime listeners, and optimistic updates. Keep state immutable, dedupe rows by id, and guard UI while data loads.
- Hard deletes should redirect to home/poker index (`router.push`). Match existing behavior when adding destructive actions.
- Respect RLS: UI should not bypass locks/visibility just because client-side state says so.
- When implementing new features, update `docs/features/*.md` + `docs/operations.md` to maintain documentation as source of truth.

## 6. Git & Review Guardrails
- Default branch: `main`. Do **not** commit unless explicitly asked. Never change git config or run destructive commands (`reset --hard`, `push --force`) without approval.
- If committing, run `pnpm fix` plus at least `pnpm check-types`. Mention any skipped validation steps in your final message.
- Keep commit/PR summaries focused on intent (“add poker statistics panel”) rather than file lists.

## 7. Validation Strategy
1. `pnpm check-types` — quick confidence signal.  
2. `pnpm build` — catches integration issues or Next config mistakes.  
3. Manual QA — open two browser contexts to validate realtime flows (presence, voting, locks, timers).  
4. Tests — currently absent; if you add one, document the command for running single tests or directories.

## 8. Edge Cases & Cleanup
- Guard for missing `userId` or `displayName`. Show the join modal when a user lacks a name (see existing pattern).
- Presence hygiene: attach `visibilitychange` + `beforeunload` listeners to mark participants offline and untrack Supabase presence; detach listeners on unmount.
- Prevent duplicate state entries when realtime inserts fire; check for existing ids before pushing into arrays.
- Maintain retro card vote counts when card rows update (carry `votes` state forward instead of resetting to zero).

## 9. File / Folder Expectations
- Prefer editing existing files. Only add new files when absolutely required—and check for nested `AGENTS.md` governing that subtree.
- Feature logic must stay in its domain (`components/retro`, `components/poker`). Shared utilities belong in `lib/` or `components/shared`.
- Store shared type definitions in `lib/types.ts` to avoid drift.

## 10. Final Hand-Off Checklist
- Ensure formatter has run (`pnpm fix` or Cursor hook).  
- Rerun `pnpm check-types` (and `pnpm build` if changes are large).  
- Call out remaining manual steps or unverified flows to the next agent.  
- Never commit secrets. Required env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.  
- Update docs (overview, features, data-model, operations) when behavior or schema changes.

Happy shipping—stay precise, stay considerate.
