# Organizations

An organization is a group of people who share retro boards and poker
sessions. Routes: `/orgs` (list and create), `/orgs/[slug]` (sessions,
members, settings), and `/orgs/join/[code]` (invite).

## Who can use them

Only accounts with a GitHub identity can create or join an organization. A
guest account lives in one browser, so a guest owner would orphan the
organization and a guest member could never be identified again; an account
registered some other way (for example by email through the Auth API) has no
verified handle. The database enforces this with
`public.is_registered_user()`, which requires a non-anonymous `auth.users`
row with an `auth.identities` row for the `github` provider. It reads the
tables rather than the JWT claims, so it is correct right after linking.
Guests see a "Continue with GitHub" card instead, and linking returns them to
the page they started on.

## Roles

| Role | Can |
| --- | --- |
| Owner | Everything: change roles, remove anyone, delete the organization, plus everything an admin can do |
| Admin | Rename the organization, manage the invite link, remove plain members, and host every session of the organization |
| Member | See the organization, its members and its sessions; open and join every session, including private ones; create sessions in it; leave |

- Only owners change roles. There can be several owners.
- The last owner cannot be demoted or leave. If the last owner's account is
  deleted, the `organization_members_keep_owner` trigger promotes the oldest
  admin, otherwise the oldest member; an organization with nobody left is
  deleted.
- Limits: 50 organizations per user and 250 members per organization.

## Invite link

- One link per organization, readable by owners and admins only. The code is
  22 URL-safe characters (about 126 random bits).
- Lifetime 1, 7 (default) or 30 days, or never. Resetting the link replaces
  the code, so the old one stops working at once; turning it off deletes it.
- Removing a member also replaces the code (keeping its lifetime), so the
  person removed cannot rejoin with the link they had. Leaving on your own
  does not, so you can rejoin with the link while it is active.
- Opening a link shows the organization's name and member count
  (`get_organization_invite`). Joining always takes an explicit click
  (`accept_organization_invite`), and joiners become members.
- The link is a capability: anyone with it and a linked account can join and
  read the organization's private sessions. The invite page sends no
  referrer, and `components/analytics.tsx` replaces the code in analytics
  page views.

## Sessions owned by an organization

- A retro board or poker session has an optional `org_id`. The person who
  created it stays its author.
- Create one in an organization from the "Belongs to" select on the retro or
  poker landing page. `/?org=<slug>` and `/poker?org=<slug>` preselect it.
- Members can open and join every session of the organization. For an
  organization's session, "private" means "the organization plus people who
  are already in it"; people outside need the host to make it public. Public
  sessions stay open to anyone with the link, guests included.
- Owners and admins are co-hosts: they can do everything the author can
  (title, timer, lock, visibility, reveal, rounds, archive, delete), and the
  participant list marks them as co-hosts for viewers who belong to the
  organization (the member list is members-only, so guests on a public
  organization session see only the author marked). They cannot change a
  session's
  address (`slug`), author name or creation time; the
  `protect_session_ownership` trigger refuses that for anyone but the author.
- A co-host whose role is removed while a session is open sees their next
  host action refused ("You can no longer change this board"), and the page
  re-reads their role.
- Moving a session (`set_session_organization`): only the author moves it
  into an organization, and only into one they belong to. The author, or an
  owner or admin of the organization, can move it back out to the author.
  `author_id` and `org_id` cannot be changed with a plain `UPDATE`.
- Removing someone, or someone leaving, also removes their participant rows
  and their current poker votes from the organization's private sessions
  they did not create. Their retro cards and votes, and recorded poker
  rounds, stay.
- Moving a private session out of an organization keeps its participant
  rows, as for any private session: people who had joined it, including
  members of the organization, keep access. Nobody new can join it while it
  is private.
- Deleting an organization keeps its sessions; they go back to their
  authors.
- A session belongs to its author's account: deleting that `auth.users` row
  (an operator action; the app has no account deletion) deletes the
  session, even when it is in an organization.

## Members list

`list_organization_members` returns each member's display name, GitHub avatar
and GitHub handle to fellow members, never an email address. The handle and
avatar come from the GitHub identity only, never from user metadata, which
its owner can edit. Display names are free text, so the GitHub handle is the
verified identity to check before promoting someone. Making someone an owner,
and demoting yourself, ask for confirmation.

## Realtime

Organization data is not replicated. Pages load it on open and reload it
after each change.

## Main Components

- `app/orgs/client-page.tsx`, `app/orgs/[slug]/OrgPageClient.tsx`,
  `app/orgs/join/[code]/JoinOrgClient.tsx`
- `components/orgs/`: create form, members panel, invite panel, settings,
  role badge
- `lib/organizations.ts`: typed wrappers around the organization functions
- `hooks/use-org-role.ts`: your role in the organization that owns the
  session you are viewing
