# AGENTS.md

Operating contract for OpenCode sessions. Every line answers: "would an agent miss this?"

## Commands

- Package manager: `pnpm` (enable with `corepack enable` if missing)
- Dev: `pnpm dev` | Prod: `pnpm build` then `pnpm start`
- Typecheck (required, see gotcha): `pnpm check-types`
- Lint+format: `pnpm fix` (runs Ultracite, which uses Biome)
- Scoped: `pnpm fix -- path/to/file` | `pnpm dlx ultracite check path/to/file`

## Build Gotcha

`next.config.mjs` sets `typescript.ignoreBuildErrors: true` + `reactCompiler: true` + `images.unoptimized: true`. `pnpm build` passes even with TS errors. Always run `pnpm check-types` separately.

## Tests

No Jest/Vitest/Playwright configured. Validation chain: `pnpm check-types` → `pnpm dlx ultracite check` → `pnpm build`. Database changes: also run `supabase/checks/organizations_rls.sql` (see `docs/operations.md`). Manual QA in two browser tabs for realtime features.

## Architecture

- `app/`: Next.js 16 App Router (routes, layouts, API routes). Root `proxy.ts` is the middleware entry point (auth session refresh via `lib/supabase/proxy.ts`).
- `app/client-page.tsx`, `app/poker/client-page.tsx`: landing pages; both render `components/shared/session-landing.tsx` (create/join UI, your sessions, recent)
- `app/retro/[slug]/RetroPageClient.tsx`: retro orchestration (client)
- `app/poker/[slug]/PokerSessionClient.tsx`: poker orchestration (client)
- `app/account/`, `app/account/sessions/`: account page and "My sessions" (client, `list_my_sessions()`)
- `app/orgs/`, `app/orgs/[slug]/`, `app/orgs/join/[code]/`: organizations, organization page, invite page
- `components/orgs/`, `components/sessions/`: organization UI and the managed session list
- `lib/organizations.ts`, `lib/sessions.ts`: typed wrappers for the organization and session RPCs; `hooks/use-org-role.ts` gives the viewer's role in a session's organization (owners and admins co-host)
- `app/new/route.ts`: retro board creation (server); poker sessions are created client-side
- `app/auth/callback/route.ts`, `app/auth/link/start/route.ts`: OAuth callback and account-linking API routes
- `components/retro/`, `components/poker/`: feature modules
- `components/shared/`: cross-feature components (session topbar, presence button, share menu, join screen, session landing, avatars)
- `components/ui/`: shadcn primitives (linter disabled — treat as vendor)
- `hooks/use-auth.ts`: central auth hook (anonymous-first + GitHub binding)
- `lib/supabase/`: five clients — `client.ts` (browser singleton), `server.ts` (RSC), `proxy.ts` (middleware), `admin.ts` (service role), `public.ts` (server, no session; for cached output such as OG images)
- `lib/site.ts`: site name, production URL and landing copy for metadata; `lib/session-metadata.ts` + `lib/session-preview.ts`: session page metadata via `get_session_preview()`
- `lib/og/render.tsx`: Open Graph image frame, fonts and palette (`app/**/opengraph-image.tsx`). Satori cannot read CSS variables, so its colours mirror `app/globals.css`; fonts must be static TTFs without extension lookups (Google Fonts API builds work, the GitHub `google/fonts` Lato does not)
- `lib/auth/linking.ts`: signed cookie helpers for secure guest-to-GitHub account merging
- `lib/types.ts`: shared domain types (RetroBoard, RetroCard, PokerSession, etc.)
- `lib/utils/`: slug generation, recent-session cookie helpers
- `lib/constants/`: error messages and poker voting scales
- `supabase/migrations/`: all schema/RLS changes. Also `supabase/schema.sql` and `supabase/RLS_POLICIES.md` as static references
- `supabase/checks/organizations_rls.sql`: psql behavioural checks for organization RLS (run against `supabase start`)
- `docs/`: product behavior source of truth

## Realtime Playbook

- Channels: `retro-${slug}`, `poker-${slug}` (subscribe on mount, cleanup on unmount)
- Replication: all retro+poker tables have `REPLICA IDENTITY FULL` + added to `supabase_realtime` publication (see migration `20260106120000_enable_realtime_replication.sql`)
- New realtime table: set `REPLICA IDENTITY FULL` and add to publication in a **new** migration following that pattern
- Presence: track/untrack on mount/unmount + visibility change handlers
- RLS is authoritative — never bypass with client-side assumptions

## Schema Changes

- All changes go in `supabase/migrations/` with timestamped filenames
- Update `docs/data-model/supabase.md` and feature docs in `docs/features/*.md` for behavior changes
- Supabase MCP template in `.cursor/mcp.json` (set `project_ref`)

## Style Conventions (Enforced by Biome/Ultracite)

- Semicolons, double quotes, trailing commas
- Linter exceptions exist for a11y, complexity, security, and style rules (see `biome.jsonc` overrides)
- `noArrayIndexKey` is off — still prefer stable keys
- `components/ui/**` linter disabled — treat as vendor
- `biome-ignore` comments are used where needed (see `lib/supabase/*.ts`)

## Design Tokens

- Colours come from the Wayfindr websites (wayfindr.io, bundle.wayfindr.io) and live only in `app/globals.css`; never hard-code hex values in components. Exceptions, where CSS variables cannot be read: `lib/og/render.tsx` (`OG_COLORS`), `viewport.themeColor` in `app/layout.tsx` and `app/manifest.ts`. Keep them in step with `globals.css`.
- Navy `foreground` ink on white `background` panels over a grey `canvas` page. Amber `primary` is the one brand and action colour; use `text-brand-text` when amber must be readable as text.
- Category accents: `success` (went well), `mauve` (to improve), `periwinkle` (action items, "revealed"), plus `sky`, `pink`, `sage`. Text on pastels uses `text-ink`.
- Dark mode is navy-based (`.dark` block). Check every change in both themes.



- `ultracite fix` auto-sorts: Externals (alphabetically, including React/Next) → `@/` → relative
- Use `import type` for type-only imports (inline `import { type X }` is also accepted)
- Remove unused imports immediately

## Common Gotchas

- `next/headers` and other server-only APIs must not be imported in client files
- Auth anomalies: `lib/supabase/client.ts` clears stale tokens on init; `clearSessionAndRecreateClient()` is the recovery path
- Middleware is at root `proxy.ts` (not in `app/`), imported from `lib/supabase/proxy.ts`
- `html2canvas` dependency exists for export/screenshot features
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are required env vars
- `SUPABASE_SERVICE_ROLE_KEY` is required for the GitHub identity linking flow (used by `lib/auth/linking.ts` and `lib/supabase/admin.ts`)
- `AUTH_LINK_COOKIE_SECRET` is optional; falls back to `SUPABASE_SERVICE_ROLE_KEY` if unset
- Tailwind v4 is configured in `app/globals.css` — there is no `tailwind.config.js`
- `.cursor/hooks.json` runs a full-project `pnpm dlx ultracite fix` after every file edit
- The repository uses pnpm exclusively; do not add npm, Yarn, or Bun lockfiles

## Handoff Checklist

Before finishing: `pnpm fix` → `pnpm check-types` → `pnpm build`
