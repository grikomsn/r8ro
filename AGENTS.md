# AGENTS.md

## Build & Development Commands

- `pnpm dev` - Start development server
- `pnpm build` - Production build
- `pnpm check-types` - Run TypeScript type checking
- `pnpm fix` - Format and lint (via Ultracite/Biome)
- No test framework configured

## Tech Stack

Next.js 16 (App Router) + React 19 + TypeScript (strict mode) + Tailwind CSS 4 + Supabase (realtime, auth, RLS)

## Code Style (enforced by Ultracite/Biome)

- **Formatting**: No semicolons, double quotes, no trailing commas. Run `pnpm fix` before committing
- **Imports**: Order: `react` hooks > external libs > `@/` internals. Use `@/*` path alias (maps to root). Use `import type { }` for types
- **Components**: Function components with explicit prop interfaces. Use `"use client"` directive at top of client components
- **Types**: Define in `lib/types.ts`. Use interfaces for objects, type aliases for unions/primitives. Enable strict mode
- **Naming**: camelCase for functions/variables, PascalCase for components/types/interfaces, kebab-case for files
- **Styling**: Use Tailwind via `cn()` utility from `lib/utils.ts`. Use shadcn/ui components from `components/ui/`
- **Error handling**: Use `console.error` for logging, prefer early returns, avoid nested ternaries
- **Async**: Always `await` promises, use `async/await` over promise chains, handle errors with try-catch
- **React**: Call hooks at top level only, include all deps in hook arrays, use `key` with unique IDs (not indices)
- **Accessibility**: Use semantic HTML, add ARIA attributes, provide alt text, use proper heading hierarchy

## App Structure

- `app/` - Next.js App Router pages and API routes
- `components/ui/` - shadcn/ui primitives (Button, Input, Dialog, etc.)
- `components/retro/` - Retro board feature components
- `components/poker/` - Scrum poker feature components
- `hooks/` - Custom React hooks (e.g., `use-auth.ts`, `use-mobile.ts`)
- `lib/supabase/` - Supabase client/server utilities
- `lib/types.ts` - Shared TypeScript types and interfaces
- `supabase/migrations/` - Database migrations with RLS policies
