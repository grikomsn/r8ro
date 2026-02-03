# Deployment Guide

This guide covers various deployment options for r8ro, from simple Vercel hosting to self-managed infrastructure.

## Quick Start (Vercel)

The fastest way to deploy r8ro is using Vercel:

1. **Fork and push to GitHub**
2. **Connect to Vercel**: Import your GitHub repository
3. **Configure environment variables** in Vercel dashboard:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

4. **Deploy**: Automatic deployment on push to `main`

## Environment Variables

### Required

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Optional

```bash
# For server-side operations
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Custom domain (if not using platform default)
NEXT_PUBLIC_APP_URL=https://your-custom-domain.com
```

## Database Setup

### Supabase Cloud (Recommended)

1. **Create Project**: Sign up at [supabase.com](https://supabase.com)
2. **Apply Schema**: Copy contents of `supabase/schema.sql` to SQL Editor
3. **Enable RLS**: Row Level Security should be enabled by default
4. **Configure Auth**:
   - Enable Anonymous auth (default)
   - Optionally add GitHub as a provider
5. **Enable Realtime**: Go to Settings → API → enable Realtime for:
   - `retro_boards`
   - `retro_cards`
   - `retro_participants`
   - `retro_card_votes`
   - `poker_sessions`
   - `poker_participants`
   - `poker_votes`

### Local Supabase

For development or complete self-hosting:

```bash
# Install CLI
brew install supabase/tap/supabase

# Initialize
supabase init
supabase start

# Apply migrations
supabase db reset
```

## Deployment Platforms

### Vercel

**Pros**: Zero config, automatic SSL, git integration
**Cons**: Vendor lock-in, less control

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Netlify

```bash
# Build command
pnpm build

# Publish directory
out

# Environment variables in Netlify dashboard
```

### Docker

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
ENV PORT 3000
CMD ["node", "server.js"]
```

```bash
# Build and run
docker build -t r8ro .
docker run -p 3000:3000 --env-file .env.local r8ro
```

### Self-Hosted VPS

```bash
# Server setup
sudo apt update
sudo apt install -y nodejs npm git nginx

# Install pnpm
npm install -g pnpm

# Clone and build
git clone https://github.com/your-username/r8ro.git
cd r8ro
pnpm install
pnpm build

# Process management with PM2
npm install -g pm2
pm2 start npm --name "r8ro" -- start

# Nginx reverse proxy
sudo nano /etc/nginx/sites-available/r8ro
```

Nginx configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/r8ro /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# SSL with Certbot
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Production Checklist

### Security

- [ ] HTTPS enabled (SSL certificate)
- [ ] Supabase RLS policies reviewed
- [ ] No secrets in client-side code
- [ ] Environment variables secured
- [ ] CORS properly configured

### Performance

- [ ] Database backups configured
- [ ] CDN for static assets (if using custom domain)
- [ ] Monitoring and alerting setup
- [ ] Error tracking (Sentry, etc.)

### Reliability

- [ ] Health checks configured
- [ ] Automated testing in CI/CD
- [ ] Database connection pooling
- [ ] Graceful error handling

### Monitoring

Set up these monitors:

1. **Application Health**: `/api/health` endpoint
2. **Database**: Supabase dashboard metrics
3. **Error Rates**: Via logging service
4. **Performance**: Page load times, API response times

## Scaling Considerations

### Database Scaling

- **Read Replicas**: For high read traffic
- **Connection Pooling**: PgBouncer or Supabase's built-in pooling
- **Optimized Queries**: Review slow queries in Supabase dashboard

### Application Scaling

- **Horizontal Scaling**: Multiple app instances behind load balancer
- **CDN**: Cloudflare or similar for static assets
- **Caching**: Redis for session data if needed

### Cost Optimization

- **Supabase Tier**: Start with free tier, upgrade as needed
- **Compute Rightsizing**: Monitor CPU/memory usage
- **Bandwidth**: Optimize images and assets

## Migration Guide

### From Another Platform

1. **Export Data**: From existing retro/poker tools
2. **Transform**: Convert to r8ro's schema format
3. **Import**: Use Supabase SQL Editor or CLI
4. **Test**: Verify all data migrated correctly

### Database Migrations

When updating r8ro versions:

```bash
# Backup current database
supabase db dump > backup.sql

# Apply new migrations
supabase db up

# Verify data integrity
pnpm run db:verify  # if available
```

## Troubleshooting

### Common Issues

**Build Failures**

```bash
# Clear Next.js cache
rm -rf .next
pnpm build
```

**Database Connection**

- Verify Supabase URL and keys
- Check network/firewall settings
- Ensure RLS policies allow access

**Realtime Issues**

- Confirm Realtime enabled for tables
- Check browser console for WebSocket errors
- Verify subscription patterns (`retro-*`, `poker-*`)

**Authentication Problems**

- Check Supabase Auth configuration
- Verify redirect URLs in Supabase dashboard
- Ensure anonymous auth is enabled

### Debug Mode

Enable debug logging:

```bash
# Environment variables
DEBUG=*
NEXT_PUBLIC_DEBUG=true
```

### Support Resources

- [r8ro GitHub Issues](https://github.com/your-org/r8ro/issues)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)

## Maintenance

### Regular Tasks

1. **Update Dependencies**: `pnpm update`
2. **Security Patches**: Monitor `npm audit`
3. **Database Maintenance**: Supabase handles most automatically
4. **Backup Verification**: Test restore procedures

### Version Updates

When updating r8ro:

1. **Review Changelog**: Check for breaking changes
2. **Test Staging**: Deploy to staging environment first
3. **Backup Database**: Before major updates
4. **Monitor**: Watch for issues after deployment

### End-of-Life

If decommissioning:

1. **Export Data**: Download all user data
2. **Notify Users**: Advance notice of shutdown
3. **Delete Resources**: Remove from hosting platforms
4. **Documentation**: Archive for reference
