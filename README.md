# r8ro

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![r8ro.app](https://img.shields.io/badge/🌐-r8ro.app-blue)](https://r8ro.app)

Realtime collaborative retrospective boards. Anonymous-first with GitHub auth binding.

![Homepage](docs/images/homepage.png)
![Board](docs/images/board-with-content.png)

## Features

### Core

- **Anonymous-first auth** — Auto sign-in as guest, optional GitHub binding to preserve identity
- **Realtime collaboration** — Live updates for cards, votes, participants via Supabase Realtime
- **3-column retro format** — Went Well / To Improve / Action Items
- **Vote tracking** — Toggle votes on cards, prevents duplicates, tracks per user
- **Timer** — Built-in session timer with play/pause/reset
- **Recent boards** — Local history of visited boards

### Scrum Poker

- **Configurable voting scales** — Fibonacci, T-shirt sizes, and linear presets (extendable via `lib/constants/poker-scales.ts`)
- **Admin controls** — Start/stop voting, reveal/hide cards, clear votes, and toggle public/private visibility
- **Observer mode** — Participants can join read-only to watch estimates without voting
- **Realtime participants & presence** — Mirrors retro flows with dedicated components under `components/poker/`
- **Statistics** — After reveal, the table surfaces min/max/average and outlier cues for the current story

### Access Control

- **Public boards** — Anyone can join, add cards, vote
- **Private boards** — Only previous participants can access
- **Locked boards** — Author-only write, everyone else read-only
- **Author privileges** — Only authors can delete their boards

### Permissions Matrix

| Action           | Public        | Private           | Locked            | Author |
| ---------------- | ------------- | ----------------- | ----------------- | ------ |
| View board       | Anyone authed | Participants only | Participants only | ✓      |
| Join board       | ✓             | ✗                 | ✗                 | ✓      |
| Add cards        | ✓             | Participants      | Author only       | ✓      |
| Edit own cards   | ✓             | Participants      | Author only       | ✓      |
| Delete own cards | ✓             | Participants      | Author only       | ✓      |
| Vote             | ✓             | Participants      | Read-only         | ✓      |
| Delete board     | ✗             | ✗                 | ✗                 | ✓      |

## Tech Stack

- **Framework** — Next.js 16 (App Router) + React 19
- **Language** — TypeScript
- **Styling** — Tailwind CSS 4 + shadcn/ui
- **Database** — Supabase (PostgreSQL + Realtime + Auth)
- **Deployment** — Vercel

## Architecture

### Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant App
    participant Supabase

    User->>App: Visit site
    App->>Supabase: signInAnonymously()
    Supabase-->>App: Anonymous UUID
    App->>User: Signed in as Guest

    opt Link to GitHub
        User->>App: Click "Sign in with GitHub"
        App->>Supabase: linkIdentity(GitHub)
        Supabase-->>App: Same UUID, now linked
        App->>User: GitHub identity preserved
    end
```

### Data Model

```mermaid
erDiagram
    retro_boards ||--o{ retro_cards : contains
    retro_boards ||--o{ retro_participants : has
    retro_cards ||--o{ retro_card_votes : receives
    auth_users ||--o{ retro_boards : authors
    auth_users ||--o{ retro_cards : authors
    auth_users ||--o{ retro_participants : joins
    auth_users ||--o{ retro_card_votes : casts

    retro_boards {
        uuid id PK
        text slug UK
        text title
        uuid author_id FK
        text author_name
        bool is_public
        bool is_locked
        bool timer_running
        int timer_seconds
        timestamptz timer_started_at
    }

    retro_cards {
        uuid id PK
        uuid board_id FK
        text column_type
        text content
        uuid author_id FK
        text author_name
    }

    retro_participants {
        uuid id PK
        uuid board_id FK
        uuid user_id FK
        text username
        bool is_online
    }

    retro_card_votes {
        uuid id PK
        uuid card_id FK
        uuid user_id FK
    }
```

### User Flow

```mermaid
flowchart TD
    Start([User visits site]) --> AutoAuth[Auto sign-in anonymous]
    AutoAuth --> HomePage[Homepage with CREATE/JOIN]

    HomePage --> Create[Click CREATE]
    HomePage --> Join[Click JOIN with slug]

    Create --> EnterName[Enter name + optional title]
    EnterName --> NewBoard[Navigate to /retro/slug]

    Join --> EnterSlug[Enter board slug]
    EnterSlug --> CheckAccess{RLS check access}
    CheckAccess -->|Public or participant| ExistingBoard[Navigate to /retro/slug]
    CheckAccess -->|Denied| Error[Error: Access denied]

    NewBoard --> BoardView[Board view]
    ExistingBoard --> BoardView

    BoardView --> Actions{User actions}
    Actions --> AddCard[Add card to column]
    Actions --> VoteCard[Toggle vote on card]
    Actions --> EditCard[Edit/delete own card]
    Actions --> ManageBoard[Manage settings]
    Actions --> ShareBoard[Share link]

    AddCard --> Realtime[Supabase Realtime broadcast]
    VoteCard --> Realtime
    EditCard --> Realtime
    ManageBoard --> Realtime

    Realtime --> AllClients[All connected clients update]
```

### RLS Policy Architecture

```mermaid
flowchart TD
    Request[Client request] --> RLS{RLS Policy Check}

    RLS --> CheckAuth{auth.uid exists?}
    CheckAuth -->|No| Deny[DENY]
    CheckAuth -->|Yes| CheckTable{Which table?}

    CheckTable -->|retro_boards| BoardPolicy[Board access policy]
    CheckTable -->|retro_cards| CardPolicy[Card access policy]
    CheckTable -->|retro_participants| ParticipantPolicy[Participant policy]
    CheckTable -->|retro_card_votes| VotePolicy[Vote policy]

    BoardPolicy --> CheckBoardAccess{Public OR Author OR Participant?}
    CheckBoardAccess -->|Yes| Allow[ALLOW]
    CheckBoardAccess -->|No| Deny

    CardPolicy --> CheckCardAccess{Board accessible AND Locked check}
    CheckCardAccess -->|Pass| Allow
    CheckCardAccess -->|Fail| Deny

    ParticipantPolicy --> HelperFunc[can_access_board function]
    HelperFunc -->|True| Allow
    HelperFunc -->|False| Deny

    VotePolicy --> CheckVoteAccess{Board accessible AND Not locked}
    CheckVoteAccess -->|Yes| Allow
    CheckVoteAccess -->|No| Deny
```

## Project Structure

```
r8ro/
├── app/
│   ├── new/route.ts              # Board creation API
│   ├── retro/[slug]/
│   │   ├── page.tsx              # Board page (server)
│   │   └── RetroPageClient.tsx   # Board UI (client + realtime)
│   ├── poker/[slug]/             # Scrum poker session route
│   │   ├── page.tsx
│   │   └── PokerSessionClient.tsx
│   └── client-page.tsx           # Homepage
├── components/
│   ├── ui/                       # shadcn/ui primitives
│   ├── retro/                    # Retro board components
│   └── poker/                    # Planning poker components
├── hooks/
│   └── use-auth.ts               # Auth state hook
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Browser client
│   │   ├── server.ts             # Server client
│   │   └── proxy.ts              # Proxy for env vars
│   ├── types.ts                  # TypeScript types
│   └── utils/
│       ├── slug.ts               # Slug generation
│       └── recent-*.ts           # Local history helpers for retro/poker
└── supabase/
    ├── schema.sql                # Complete schema dump
    ├── RLS_POLICIES.md           # RLS documentation
    └── README.md                 # Schema overview
```

## Documentation

- `docs/README.md` — index of every doc plus authoring conventions.
- `docs/overview.md` — high-level product summary and architecture highlights.
- `docs/features/retro.md` / `docs/features/poker.md` — deep dives into each realtime experience.
- `docs/data-model/supabase.md` — canonical schema + RLS reference linked to migrations.
- `docs/operations.md` — local setup, Supabase introspection steps, and documentation refresh checklist.
- `docs/deployment.md` — comprehensive deployment guides for various platforms.

## Development

### Setup

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Add your Supabase URL and anon key

# Run dev server
pnpm dev
```

### Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Database Setup

Apply schema from `supabase/schema.sql`:

```bash
# Using Supabase CLI
supabase db reset

# Or apply manually via Supabase Dashboard
# Copy contents of supabase/schema.sql to SQL Editor
```

### Commands

- `pnpm dev` — Start dev server
- `pnpm build` — Production build
- `pnpm lint` — Run ESLint

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

### Quick Start for Contributors

1. **Fork** the repository
2. **Clone** your fork locally
3. **Create** a feature branch: `git checkout -b feature-name`
4. **Set up** local development:

   ```bash
   pnpm install
   cp .env.example .env.local
   # Add your Supabase credentials
   pnpm dev
   ```

5. **Make changes** and follow the code style in `AGENTS.md`
6. **Submit** a pull request with clear description

See [docs/operations.md](docs/operations.md) for detailed development setup.

## Deployment

r8ro can be deployed on various platforms. See [docs/deployment.md](docs/deployment.md) for comprehensive deployment guides including:

- **Vercel** (recommended for simplicity)
- **Netlify**
- **Docker containers**
- **Self-hosted VPS**
- **Cloud providers** (AWS, Google Cloud, etc.)

## Author

Created by **[Griko Nibras](https://grikomsn.com)** - a full-stack developer focused on collaborative tools and real-time applications.

## Security

- All tables protected by Row Level Security (RLS)
- Helper function `can_access_board()` prevents recursion in participant checks
- Policies optimized with `(SELECT auth.uid())` pattern for performance
- Anonymous users get full Supabase Auth UUIDs (can be upgraded to GitHub)

See [`supabase/RLS_POLICIES.md`](supabase/RLS_POLICIES.md) for detailed policy documentation.
