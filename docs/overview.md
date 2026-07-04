# Architecture Overview

r8ro has two Next.js App Router experiences:

| Experience | Landing page | Session client | Tables |
| --- | --- | --- | --- |
| Retrospective | `app/client-page.tsx` | `app/retro/[slug]/RetroPageClient.tsx` | `retro_boards`, `retro_cards`, `retro_participants`, `retro_card_votes` |
| Planning poker | `app/poker/client-page.tsx` | `app/poker/[slug]/PokerSessionClient.tsx` | `poker_sessions`, `poker_participants`, `poker_votes` |

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
- Database authorization is defined by `supabase/schema.sql` plus ordered
  migrations in `supabase/migrations/`.

See the feature documents for behavior and
[data-model/supabase.md](data-model/supabase.md) for database details.
