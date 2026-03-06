# Operations & Rebuild Playbook

Use this checklist when spinning the project up from scratch, syncing Supabase schema changes, or refreshing documentation. This guide serves both internal development and external contributors setting up r8ro for self-hosting.

## Local Environment

1. **Install dependencies**
   ```bash
   pnpm install
   ```
2. **Run dev server**
   ```bash
   pnpm dev
   ```
3. **Typecheck & build**
   ```bash
   pnpm check-types
   pnpm build
   ```
4. **Format & lint**
   ```bash
   pnpm fix
   ```
5. **Environment variables**: populate `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Supabase Introspection Workflow

1. **Connect via MCP**
   - Preferred for quick checks: run `supabase_execute_sql` queries to inspect tables, policies, or helper functions directly against project `dpdrtbkckcnedtbuwtiu`.
2. **Schema pull**
   ```bash
   supabase db pull --debug
   mv supabase/.temp/schema.sql supabase/schema.sql
   ```
3. **Generate migrations**
   ```bash
   supabase db diff -f <timestamp_description>
   ```
4. **Replay migrations locally**
   ```bash
   supabase db reset
   supabase db up
   ```
5. **Realtime replication sanity check**
   - After adding tables, re-run `supabase/migrations/20260106120000_enable_realtime_replication.sql` or craft an equivalent to set `REPLICA IDENTITY FULL` and add tables to `supabase_realtime`.

## Documentation Refresh

1. Update `docs/data-model/supabase.md` whenever schema or RLS policies change. Cite the migration filename responsible for each change.
2. Keep `docs/features/*.md` aligned with corresponding components:
   - Retro → `app/retro/[slug]/RetroPageClient.tsx`, `components/retro/*`.
   - Poker → `app/poker/[slug]/PokerSessionClient.tsx`, `components/poker/*`.
3. Regenerate diagrams or screenshots inside `docs/images/` if UI shifts materially.
4. Cross-link updates back into `README.md` so external readers know where to find details.

## From Zero to Productive

1. Clone repo + install dependencies (`pnpm install`).
2. Configure Supabase env vars and confirm anonymous auth works via `useAuth` logs.
3. Run `pnpm dev`, open `/` and `/poker` to verify landing flows.
4. Follow Supabase workflow above to ensure schema files match the remote database.
5. Walk through the feature docs under `docs/features/` to understand realtime flows before editing code.
6. When done, re-run `pnpm check-types` and `pnpm build` before committing, and document deltas here as needed.

## Open Source Contributor Setup

External contributors should follow these additional steps:

1. **Fork the repository** on GitHub and clone your fork
2. **Create a feature branch** from `main`: `git checkout -b feature-name`
3. **Set up Supabase locally** using Docker or the Supabase CLI:

   ```bash
   supabase init
   supabase start
   ```

4. **Apply migrations** from `supabase/migrations/` to your local instance
5. **Test changes** thoroughly with the validation strategy below
6. **Submit pull requests** targeting the `main` branch with clear descriptions

## Self-Hosting Deployment Guide

### Prerequisites

- Node.js 18+
- pnpm package manager
- Supabase account (hosted) or local Supabase instance
- Domain (optional, for production)

### Environment Configuration

Create `.env.local` with required variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Optional: Supabase Service Role Key for server operations
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional: dedicated secret for link-cookie HMAC signing
AUTH_LINK_COOKIE_SECRET=your_link_cookie_secret
```

### Database Setup

#### Option 1: Supabase Cloud (Recommended)

1. Create a new Supabase project
2. Apply schema from `supabase/schema.sql` via SQL Editor
3. Enable Row Level Security (RLS) on all tables
4. Configure Auth providers (GitHub optional)
5. Enable Realtime for required tables

#### Option 2: Local Supabase

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Initialize project
supabase init

# Start local stack
supabase start

# Apply migrations
supabase db reset
```

### Deployment Options

#### Vercel (Simplest)

1. Connect GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on push to `main`

```bash
# Local build test
vercel build
```

#### Docker

```dockerfile
# Dockerfile (create if not exists)
FROM node:18-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm build
EXPOSE 3000
CMD ["pnpm", "start"]
```

```bash
# Build and run
docker build -t r8ro .
docker run -p 3000:3000 --env-file .env.local r8ro
```

#### Self-Hosted VPS

```bash
# On server
git clone https://github.com/your-username/r8ro.git
cd r8ro
pnpm install
pnpm build

# Use PM2 for process management
npm install -g pm2
pm2 start npm --name "r8ro" -- start

# Configure reverse proxy (nginx example)
# /etc/nginx/sites-available/r8ro
server {
    listen 80;
    server_name your-domain.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Production Considerations

1. **Database Backups**: Configure automated backups in Supabase
2. **SSL Certificates**: Use HTTPS in production (Let's Encrypt recommended)
3. **Rate Limiting**: Implement API rate limiting if needed
4. **Monitoring**: Set up error tracking (Sentry) and uptime monitoring
5. **Scaling**: Consider Vercel's scaling options or horizontal server scaling

### Troubleshooting Common Issues

- **CORS Errors**: Ensure your Supabase project allows your domain
- **Realtime Issues**: Verify Realtime is enabled for required tables
- **Auth Problems**: Check Supabase Auth configuration and redirect URLs
- **Build Failures**: Run `pnpm check-types` and `pnpm build` locally first
