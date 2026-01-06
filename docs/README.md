# r8ro Documentation Index

This folder is the canonical reference for r8ro's product behavior, architecture, and operational runbooks. Each document focuses on a single dimension of the system so future contributors can rebuild knowledge from scratch without scraping the codebase.

## Directory Map

| Path | Purpose |
| --- | --- |
| `docs/overview.md` | Product summary, user segments, and feature matrix for retro boards + poker sessions. |
| `docs/features/retro.md` | Detailed retro board flows, realtime behaviors, and UI states mapped to underlying data. |
| `docs/features/poker.md` | Planning poker lifecycle, admin/participant capabilities, and realtime signaling. |
| `docs/data-model/supabase.md` | Database tables, helper functions, RLS policies, and instructions for regenerating schema dumps. |
| `docs/operations.md` | Local setup, validation order, Supabase introspection checklist, and documentation refresh workflow. |
| `docs/images/` | Reference screenshots used by README and feature docs. |

## Authoring Guidelines

1. Prefer linking to source files (e.g., `app/retro/[slug]/RetroPageClient.tsx`) instead of duplicating large code blocks.
2. Summaries should state *why* a flow exists, not only *what* components do.
3. When describing Supabase behavior, cite the migration or helper function responsible so contributors can trace changes.
4. Keep diagrams in Mermaid notation so they render consistently in GitHub and mdx-based viewers.

## Starting Fresh

If the repo or docs drift, run through `docs/operations.md` to regenerate schema metadata, verify migrations, and refresh diagrams. Each feature doc assumes the Supabase schema described there matches the latest `supabase/migrations/*` files.
