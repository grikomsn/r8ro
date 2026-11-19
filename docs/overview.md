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
  handlers use `lib/supabase/server.ts`.
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

See the feature documents for behavior and
[data-model/supabase.md](data-model/supabase.md) for database details.
