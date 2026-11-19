# Account and Session Management

## Account (`/account`)

- Profile: avatar (the GitHub avatar for a linked account, otherwise
  initials), display name, and how you are signed in.
- Guests see "Continue with GitHub". Linking keeps their sessions on any
  device; if the GitHub account already has r8ro data, this browser's guest
  sessions are moved into it (`app/auth/callback/route.ts`).
- Linked accounts can sign out (`signOut` in `hooks/use-auth.ts`). It ends the
  session in this browser only (`scope: "local"`), clears the recent-session
  cookies, and the browser continues as a new guest. Guests cannot sign out,
  because they would lose everything they own. With several tabs open, only
  the tab that signs out creates the new guest account; the others pick up
  its session (or reload after a few seconds if they do not receive it).
- Also on the page: your organizations, appearance, and the JSON export,
  which now includes `organizations` with their member lists.
- The account popover in the header links to Account, My sessions and
  Organizations on every screen width. The header shows Sessions and Orgs
  from the `md` breakpoint up.

## My sessions (`/account/sessions`)

- Lists every retro and poker session you created or joined, from
  `list_my_sessions()`. It works for guests too.
- Filters: type, created or joined, active or archived, and a title or code
  search.
- Row actions depend on what you may do (`can_manage` is the author, or an
  owner or admin of the owning organization):
  - Rename, make public or private, lock (retro), archive or restore, delete:
    `can_manage`.
  - Move into one of your organizations: the author. Hand back to the author:
    an owner or admin of the owning organization.
  - Leave: a participant who is not the author. Your cards stay; a poker vote
    is withdrawn.
- The organization page shows the same list for every session of the
  organization.

## Archive

`archived_at` files a session away. Archived sessions are hidden from the
landing page's "Yours" list and from the default "Active" filter, and show an
"Archived" chip. Archiving changes nothing else: everyone can still open it,
and the host can restore it from the session menu or the list.

## Main Components

- `app/account/client-page.tsx`, `app/account/sessions/client-page.tsx`
- `components/sessions/managed-session-list.tsx`
- `components/auth/link-github-card.tsx`, `components/auth/sign-out-button.tsx`
- `lib/sessions.ts`, `lib/auth/profile.ts`
