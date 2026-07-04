# Deployment Guide

The maintained production path is Supabase Cloud plus Vercel. Other Node.js
hosts can run the application, but they are not covered by repository
automation.

## Environment Variables

Configure these values in the hosting platform. Do not commit them.

| Variable | Required | Exposure | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Browser | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser | Supabase publishable/anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for GitHub linking fallback | Server only | Secure guest-account merge |
| `AUTH_LINK_COOKIE_SECRET` | No | Server only | Dedicated HMAC secret; falls back to the service-role key |

Values prefixed with `NEXT_PUBLIC_` are included in the browser bundle. Never
put a service-role key or other privileged credential in a public variable.

## Prepare Supabase

For a fresh Supabase project:

1. Run `supabase/schema.sql` in the SQL Editor.
2. Run every file in `supabase/migrations/` in filename order.
3. Enable anonymous sign-ins under **Authentication → Sign In / Providers**.
4. Configure Realtime for the tables listed in
   `20260106120000_enable_realtime_replication.sql`.
5. Review the policies documented in `supabase/RLS_POLICIES.md`.

The schema file establishes the retro baseline. The migrations add poker,
Realtime configuration, policy changes, and account-linking support.

## Configure Authentication

In **Authentication → URL Configuration**:

- Set **Site URL** to the production origin, for example
  `https://example.com`.
- Add the production callback:
  `https://example.com/auth/callback`.
- Add each development callback exactly, for example
  `http://localhost:3000/auth/callback`.

If development uses another port, that exact origin must be allow-listed.

To enable GitHub:

1. Create a GitHub OAuth app.
2. Use the Supabase provider callback shown in the Supabase dashboard as the
   OAuth app authorization callback.
3. Add the GitHub client ID and secret to the Supabase GitHub provider.

GitHub credentials belong in Supabase, not in this application's environment
files.

## Deploy to Vercel

1. Import the GitHub repository in Vercel.
2. Add the environment variables above for Production and Preview as needed.
3. Deploy the `main` branch.
4. Add the final production domain to the Supabase Site URL and redirect
   allow-list.

The repository pins Node and pnpm in `package.json`; `vercel.json` enforces the
pnpm install command.

Before deploying a change locally, run:

```bash
pnpm install --frozen-lockfile
pnpm fix
pnpm check-types
pnpm build
```

## Run on Another Node.js Host

Use Node.js 24 and provide the same environment variables:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Place a TLS-terminating reverse proxy in front of the app and forward WebSocket
connections if the platform requires explicit configuration.

## Production Checklist

- HTTPS is enabled.
- Production and preview callback URLs are allow-listed in Supabase.
- Server-only credentials are not exposed through `NEXT_PUBLIC_` variables.
- All tables have the intended RLS policies.
- Realtime replication is enabled for retro and poker tables.
- `pnpm check-types` and `pnpm build` pass.
- A guest sign-in and a GitHub identity-link flow both complete.
- A two-browser realtime retro and poker smoke test passes.
