# Deployment

The repository is configured for Vercel and Supabase.

## Environment

| Variable | Required | Scope |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser |
| `SUPABASE_SERVICE_ROLE_KEY` | For GitHub merge fallback | Server only |
| `AUTH_LINK_COOKIE_SECRET` | No | Server only |

`AUTH_LINK_COOKIE_SECRET` falls back to the service-role key. Never place a
privileged key in a `NEXT_PUBLIC_` variable.

The guest-account merge RPC is restricted to `service_role` at the database
level. Keep the merge flow in server-only routes that use
`lib/supabase/admin.ts`.

## Supabase

For a new project:

1. Apply `supabase/schema.sql`.
2. Apply `supabase/migrations/*.sql` in filename order.
3. Enable anonymous authentication.
4. Enable the GitHub provider if GitHub linking is required.
5. Verify that the Realtime migration added all application tables.

In **Authentication → URL Configuration**, set the production Site URL and add
exact callback URLs:

```text
https://your-domain.example/auth/callback
http://localhost:3000/auth/callback
```

Add a separate callback for any other local port.

For GitHub OAuth, put the GitHub client credentials in the Supabase provider
configuration. The GitHub OAuth callback is the Supabase callback shown by the
dashboard, not this app's `/auth/callback` route.

## Vercel

1. Import the repository.
2. Configure the environment variables above.
3. Deploy `main`.
4. Add the deployed origin to the Supabase Site URL and redirect allow-list.

`package.json` selects Node.js 24 and pnpm. `vercel.json` uses:

```text
pnpm install --frozen-lockfile
pnpm build
```

Before deployment, run `pnpm fix`, `pnpm check-types`, and `pnpm build`.
