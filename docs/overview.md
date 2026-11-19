# Architecture Overview

r8ro has two session experiences, plus account and organization pages:

| Experience | Landing page | Session client | Tables |
| --- | --- | --- | --- |
| Retrospective | `app/client-page.tsx` | `app/retro/[slug]/RetroPageClient.tsx` | `retro_boards`, `retro_cards`, `retro_participants`, `retro_card_votes` |
| Planning poker | `app/poker/client-page.tsx` | `app/poker/[slug]/PokerSessionClient.tsx` | `poker_sessions`, `poker_participants`, `poker_votes`, `poker_rounds` |

| Page | Route | Client | Reads |
| --- | --- | --- | --- |
| Account | `/account` | `app/account/client-page.tsx` | Auth user, `list_my_organizations()` |
| My sessions | `/account/sessions` | `app/account/sessions/client-page.tsx` | `list_my_sessions()` |
| Organizations | `/orgs`, `/orgs/[slug]` | `app/orgs/client-page.tsx`, `app/orgs/[slug]/OrgPageClient.tsx` | `organizations`, `organization_members`, `organization_invites` |
| Invite | `/orgs/join/[code]` | `app/orgs/join/[code]/JoinOrgClient.tsx` | `get_organization_invite()` |

## Shared Behavior

- `hooks/use-auth.ts` creates an anonymous Supabase session when no valid
  session exists and exposes optional GitHub identity linking.
- Browser clients use `lib/supabase/client.ts`; server components and route
  handlers use `lib/supabase/server.ts`. `lib/supabase/public.ts` is a
  session-less server client for output that is shared and cached, such as
  Open Graph images.
- `proxy.ts` refreshes Supabase auth cookies through
  `lib/supabase/proxy.ts`.
- Session clients load rows from Supabase, subscribe to Postgres changes, and
  track presence on `retro-${slug}` or `poker-${slug}` channels.
- Recent-session lists are stored in browser cookies by
  `lib/utils/recent-boards.ts` and
  `lib/utils/recent-poker-sessions.ts`.
- Retro boards and poker sessions can belong to an organization
  (`org_id`). Members can open them, and owners and admins host them; see
  [features/organizations.md](features/organizations.md).
- Database authorization is defined by ordered migrations in
  `supabase/migrations/`.

## Search and Link Previews

- Only `/` (retro) and `/poker` are indexable. `app/robots.ts` and
  `app/sitemap.ts` list them; every session, account and organization page
  sends `noindex`. Preview deployments disallow everything.
- Site name, production URL and landing copy live in `lib/site.ts`. Canonical
  URLs always point at `https://r8ro.app`; `metadataBase` is the running
  deployment so that previews link to their own images.
- The landing pages render in full on the server; only the create and join
  actions wait for the anonymous session.
- Open Graph images are generated with `next/og` from `lib/og/render.tsx`:
  static ones for the two landing pages, and per-session ones at
  `/retro/[slug]/opengraph-image` and `/poker/[slug]/opengraph-image` that
  show the title, host and counts of a public session (from
  `get_session_preview`) and a generic invitation otherwise. The fonts in
  `lib/og/fonts/` are Latin subsets from Google Fonts (OFL); the colours
  repeat the light tokens of `app/globals.css`.

See the feature documents for behavior and
[data-model/supabase.md](data-model/supabase.md) for database details.
