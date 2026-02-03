# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2025.12] - 2025-12-XX

### Added

- Realtime collaborative retrospective boards with 3-column format
- Anonymous-first authentication with optional GitHub binding
- Realtime presence tracking and participant management
- Vote tracking system with duplicate prevention
- Built-in session timer with play/pause/reset controls
- Recent boards local history
- Scrum poker integration with configurable voting scales
- Admin controls for poker sessions (start/stop voting, reveal/hide cards)
- Observer mode for non-participating users
- Realtime statistics display (min/max/average, outlier detection)
- Public/Private/Locked board access controls
- Comprehensive RLS policy system for security
- Mobile-responsive design with shadcn/ui components

### Security

- Row Level Security on all database tables
- Helper function `can_access_board()` for recursive participant checks
- Optimized RLS policies with `(SELECT auth.uid())` pattern
- Anonymous user support with upgrade path to GitHub auth

### Architecture

- Next.js 16 App Router with React 19
- TypeScript with strict type checking
- Supabase integration (PostgreSQL + Realtime + Auth)
- Tailwind CSS 4 + shadcn/ui styling system
- Biome/Ultracite for code formatting and linting

### Documentation

- Comprehensive documentation in `docs/` directory
- Architecture diagrams with Mermaid
- Feature-specific documentation for retro and poker workflows
- Data model documentation with RLS policy explanations
- Operations guide for local development and deployment

## [Unreleased]

### Added

- Open-source preparation with GitHub templates
- Contributing guidelines and code of conduct
- Initial changelog for release tracking
