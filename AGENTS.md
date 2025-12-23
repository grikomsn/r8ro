# AGENTS.md

## Build & Development Commands

- `pnpm dev` - Start development server
- `pnpm build` - Production build
- `pnpm lint` - Run ESLint
- No test framework configured

## Tech Stack

Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 + Supabase (realtime, auth)

## Code Style

- **Imports**: Use `@/*` path alias (maps to root). Order: `react` > external > `@/` internal
- **Components**: Function components with explicit prop interfaces. Use `"use client"` directive for client components
- **Types**: Define in `lib/types.ts`. Use `type` imports: `import type { X } from "..."`
- **Naming**: camelCase functions/variables, PascalCase components/types, kebab-case files
- **Styling**: Tailwind classes via `cn()` utility from `lib/utils.ts`. Use shadcn/ui components from `components/ui/`
- **Error handling**: Use console.error for logging, return early on errors
- **Formatting**: No semicolons, double quotes for imports/JSX strings

## App Structure

- `app/` - Next.js App Router pages and API routes
- `components/ui/` - shadcn/ui primitives (Button, Input, etc.)
- `components/retro/` - Retro board feature components
- `hooks/` - Custom React hooks (e.g., `use-auth.ts`)
- `lib/supabase/` - Supabase client/server utilities
