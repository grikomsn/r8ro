# r8ro Overview

r8ro delivers two collaborative experiences—retrospective boards and planning poker—built on a shared realtime, anonymous-first foundation. These notes provide the product context you need before diving into feature-level docs.

## Product Snapshot

- **Anonymous-first auth** ensures every visitor receives a Supabase Auth UUID immediately, then optionally links GitHub for persistence.
- **Realtime Supabase channels** (`retro-${slug}` / `poker-${slug}`) broadcast Postgres changes and presence so UI state stays in sync without polling.
- **Author-governed privacy** supports public, private, and locked sessions with RLS enforcing the same logic on the backend.
- **Optimistic client flows** give instant feedback for toggles (visibility, locks, voting) while Supabase confirms the writes.

## Feature Matrix

| Capability | Retro Boards | Planning Poker |
| --- | --- | --- |
| Create/Join Landing | `app/page.tsx` + `app/client-page.tsx` | `app/poker/page.tsx` + `app/poker/client-page.tsx` |
| Main Client | `app/retro/[slug]/RetroPageClient.tsx` | `app/poker/[slug]/PokerSessionClient.tsx` |
| Components | `components/retro/*` (columns, header, timer, participants) | `components/poker/*` (header, voting cards, tables, controls) |
| Data Tables | `retro_boards`, `retro_cards`, `retro_participants`, `retro_card_votes` | `poker_sessions`, `poker_participants`, `poker_votes` |
| Lock / Visibility | `is_locked`, `is_public` on boards | `is_voting_active`, `votes_revealed`, `is_public` on sessions |
| Presence | Supabase presence + `retro_participants.is_online` | Same pattern on `poker_participants.is_online` |

## Architecture Highlights

1. **Next.js App Router** organizes server components (data fetch + metadata) separately from client components that manage realtime channels.
2. **Shared Hooks & Utils**
   - `hooks/use-auth.ts` orchestrates anonymous auth, display names, and GitHub linking.
   - `lib/utils/*` houses slug generation, recent session storage, and helper constants like voting scales.
3. **Supabase Access Layer**
   - `lib/supabase/client.ts` wraps the browser client.
   - `lib/supabase/server.ts` / `proxy.ts` provide server-side helpers when needed.
4. **Documentation Stack**
   - This overview + `docs/features/*.md` explain business logic.
   - `docs/data-model/supabase.md` mirrors migrations and helper functions.
   - `docs/operations.md` is the regeneration checklist for both code and docs.

## Where to Go Next

- Need behavioral detail? Jump to `docs/features/retro.md` or `docs/features/poker.md`.
- Need database truth? Consult `docs/data-model/supabase.md` plus the migrations under `supabase/migrations/`.
- Rebuilding locally? Follow `docs/operations.md` to reproduce schema dumps, run pnpm scripts, and refresh these docs.
