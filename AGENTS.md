# AGENTS GUIDE (v4)

This file is the operating contract for coding agents in this repo.
Prefer repo-specific and framework-specific knowledge over generic advice.

## 1. Build, Lint, Typecheck, Run

- Package manager: `pnpm` (if missing: `corepack enable`).
- Install deps: `pnpm install`
- Dev server: `pnpm dev`
- Start production server: `pnpm start`
- Production build: `pnpm build`
- Required typecheck: `pnpm check-types`

Lint/format (Ultracite + Biome):

- Auto-fix + lint: `pnpm fix`
- Lint only: `pnpm dlx ultracite check`
- Diagnostics: `pnpm dlx ultracite doctor`

## 2. Test Strategy (Important)

- No Jest/Vitest/Playwright/Cypress test suite is configured.
- There is no true "run a single test" command in this repo.
- Use this sequence instead: `pnpm check-types` -> `pnpm dlx ultracite check` -> `pnpm build`.
- For scoped validation (closest equivalent to single-test runs):
  - `pnpm fix -- path/to/file.tsx`
  - `pnpm dlx ultracite check path/to/file.tsx`
  - `pnpm dlx ultracite fix "app/retro/[slug]/RetroPageClient.tsx" components/retro/retro-column.tsx`

Build gotcha:

- `next.config.mjs` sets `typescript.ignoreBuildErrors: true`.
- `pnpm build` does not fail on TS errors, so `pnpm check-types` is mandatory.

## 3. Architecture Map

- `app/`: Next.js 16 App Router surface (routes, pages, server handlers).
- `app/retro/[slug]/RetroPageClient.tsx`: retro realtime orchestration client.
- `app/poker/[slug]/PokerSessionClient.tsx`: poker realtime orchestration client.
- `components/retro/`, `components/poker/`: feature modules.
- `components/ui/`: shadcn primitives treated as vendor-like.
- `hooks/`: shared hooks (`hooks/use-auth.ts` is central).
- `lib/`: Supabase clients, shared helpers, cross-feature types.
- `supabase/`: migrations, schema artifacts, RLS references.
- `docs/`: operational and product behavior source-of-truth.

## 4. Cursor and Copilot Instruction Sources

- Cursor hook exists: `.cursor/hooks.json` runs `pnpm dlx ultracite fix` after edits.
- Cursor MCP template exists: `.cursor/mcp.json` (set your Supabase `project_ref`).
- `.cursor/plans/*` exists but is historical context, not active policy.
- No `.cursor/rules/` directory in this repo.
- No `.cursorrules` file in this repo.
- No `.github/copilot-instructions.md` file in this repo.

## 5. Formatting and Linting Rules

- Formatter output is authoritative: do not hand-format against it.
- Style baseline: no semicolons, prefer double quotes, keep diffs minimal.
- Biome config extends Ultracite presets in `biome.jsonc`.
- Lint overrides are intentional (certain a11y/style/security rules are disabled).
- `components/ui/**/*` has linter disabled by override: treat as vendor unless asked.

## 6. Import Conventions

- Keep import groups in this order with one blank line between groups:
  1. React/Next
  2. external packages
  3. `@/` absolute imports
  4. relative imports
- Use `import type { ... }` for type-only imports.
- Remove unused imports immediately.

## 7. TypeScript and Type Design

- `tsconfig.json` is strict (`strict: true`).
- Prefer `unknown` to `any`, then narrow with guards.
- Put shared domain/data contracts in `lib/types.ts`.
- Keep component-local interfaces local when not reused.
- Prefer discriminated unions and `as const` options for finite states.
- Add explicit return types to exported hooks/functions when logic is non-trivial.

## 8. Naming and File Conventions

- Components and type names: PascalCase.
- Variables and functions: camelCase.
- Feature component filenames under `components/**`: kebab-case.
- Next route conventions must stay canonical: `page.tsx`, `layout.tsx`, `route.ts`.
- Orchestrator clients under `app/**` currently use PascalCase filenames.

## 9. React and Next.js Practices

- Default to Server Components; add `"use client"` only when required.
- Do not define components inside other components.
- Hooks only at top level; no conditional hooks; dependencies complete.
- Use immutable state updates (`setState((prev) => ...)`).
- Prefer `Promise.all` for independent async work.
- Never import server-only modules into client components.

Realtime-specific React behavior:

- Deduplicate by stable row/entity `id` on incoming events.
- Merge updates into existing state instead of resetting derived fields.
- Preserve derived values (vote counts, reveal state, local UI flags) unless intentionally changed.

## 10. Supabase and Realtime Playbook

- Browser client: `lib/supabase/client.ts` (`createClient()` singleton + token self-healing).
- Server client: `lib/supabase/server.ts`.
- Middleware helper: `lib/supabase/proxy.ts`.
- Channel naming convention: `retro-${slug}` and `poker-${slug}`.
- Channel lifecycle: subscribe on mount, unsubscribe and untrack presence on cleanup.
- Treat RLS as the hard source of truth; never bypass with client-side assumptions.
- New realtime table checklist:
  - `REPLICA IDENTITY FULL`
  - add table to `supabase_realtime` publication
  - mirror approach in `supabase/migrations/20260106120000_enable_realtime_replication.sql`

## 11. Error Handling and Logging

- Supabase mutations: always handle `{ error }` explicitly.
- Permission-gated reads/navigation decisions: handle read errors explicitly.
- Prefer user-visible failures (toast/inline) over silent fail paths.
- `console.error` is acceptable for failures.
- Do not ship `console.log`, `debugger`, or `alert`.
- Use `try/catch` for multi-step async flows that should fail as a unit.

## 12. UI and Accessibility Conventions

- Tailwind v4 is configured via `app/globals.css` and `postcss.config.mjs`.
- Use `cn()` from `lib/utils.ts` for conditional class composition.
- Prefer existing `components/ui/` primitives over custom controls.
- Preserve current design language (warm palette, rounded surfaces, project fonts).
- Keep semantic HTML, focus-visible states, and `aria-label` on icon-only actions.

## 13. Manual QA Checklist (No Automated Tests)

- Retro: two-browser sync for card create/update/delete and vote counts.
- Retro: verify lock/unlock, visibility toggles, and timer start/stop/reset propagation.
- Poker: verify join, vote, reveal/hide, clear votes, and observer mode in two windows.
- Refresh during active session: ensure auth persistence and presence recovery.

## 14. Docs, Migrations, and Handoff

- Schema/RLS changes require a migration in `supabase/migrations/`.
- Update `docs/data-model/supabase.md` for schema/policy behavior changes.
- Update feature/ops docs (`docs/features/*.md`, `docs/operations.md`) for behavior changes.
- Before handoff (and before commits), run: `pnpm fix`, `pnpm check-types`, `pnpm build`.
- Never commit secrets. Required env vars include:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 15. Git and Workspace Hygiene

- Default branch: `main`.
- Do not commit unless explicitly asked.
- Never change git config from an agent session.
- Avoid destructive git operations unless explicitly requested.
- Keep changes scoped; avoid unrelated drive-by refactors.

## 16. Common Gotchas

- Runtime can look healthy while TS is broken: always run `pnpm check-types`.
- Auth anomalies can be stale token issues; `lib/supabase/client.ts` performs token cleanup.
- Do not import `next/headers` or similar server-only APIs into client files.
- Even though `noArrayIndexKey` is disabled, still prefer stable keys for dynamic lists.
