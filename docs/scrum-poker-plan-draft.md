# Scrum Poker Feature Implementation Plan

## Overview

A new `/scrum-poker` route for planning poker sessions, following r8ro's collaborative architecture with realtime sync, anonymous-first auth, and similar UI patterns to the retro boards.

---

## Database Schema

### New Tables

**`poker_sessions`**

- `id` (uuid, primary key)
- `slug` (text, unique) - URL-friendly identifier
- `title` (text) - Session name (e.g., "Sprint 42 Planning")
- `author_id` (uuid) - Creator/admin user ID
- `voting_scale` (text[]) - Array of vote options, e.g., ["1","2","3","5","8","13","21","?"]
- `current_story` (text, nullable) - Current story/task being estimated
- `votes_revealed` (boolean) - Whether votes are visible to all
- `is_voting_active` (boolean) - Whether voting is currently open
- `is_public` (boolean) - Public/private visibility
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

**`poker_participants`**

- `id` (uuid, primary key)
- `session_id` (uuid, foreign key → poker_sessions)
- `user_id` (uuid) - User identifier
- `display_name` (text) - User's display name
- `is_online` (boolean)
- `is_observer` (boolean) - Observers can watch but not vote
- `joined_at` (timestamptz)

**`poker_votes`**

- `id` (uuid, primary key)
- `session_id` (uuid, foreign key → poker_sessions)
- `story_id` (uuid, nullable) - For tracking multiple stories in a session
- `user_id` (uuid) - Voter's user ID
- `vote_value` (text) - Selected value from voting_scale
- `created_at` (timestamptz)

**`poker_stories`** (Optional - for tracking multiple stories)

- `id` (uuid, primary key)
- `session_id` (uuid, foreign key → poker_sessions)
- `title` (text) - Story/task name
- `description` (text, nullable)
- `final_estimate` (text, nullable) - Agreed-upon estimate
- `is_active` (boolean) - Currently being estimated
- `completed_at` (timestamptz, nullable)
- `created_at` (timestamptz)

---

## Route Structure

```plaintext
/scrum-poker
├── page.tsx (landing/create/join interface - similar to home page)
└── [slug]/
    ├── page.tsx (server component - metadata, initial data)
    └── PokerSessionClient.tsx (main client component)
```

---

## UI Components Structure

### `/scrum-poker`Landing Page

Reuses the home page pattern with Create/Join tabs:

**Create Tab:**

- Session name input
- Voting scale selector (dropdown with presets: Fibonacci, T-shirt sizes, Linear)
- Custom scale option
- Public/Private toggle
- "Start Session" button

**Join Tab:**

- Session slug input
- Display name input (pre-filled from useAuth if available)
- "Join Session" button

---

### `/scrum-poker/[slug]`Session Page

#### Header Component (`components/poker/session-header.tsx`)

Similar to `board-header.tsx`:

- **Left section:** Logo, session title (editable by admin), slug display
- **Center section:** Current story title (editable by admin), participant count
- **Right section:**

- Participants popover
- Share button (copy link/markdown)
- Settings menu (admin only - change scale, toggle public/private)
- Visibility indicator

#### Admin Controls (`components/poker/admin-controls.tsx`)

Only visible to session author:

- "Start Voting" / "Stop Voting" toggle button
- "Reveal Cards" / "Hide Cards" toggle button
- "Clear Votes" button
- "New Story" button (clears votes, prompts for new story title)
- Voting scale configuration (accessible via settings menu)

#### Voting Interface (`components/poker/voting-cards.tsx`)

- Card grid displaying all values from `voting_scale`
- Each card is clickable/selectable
- Selected card has highlight/border (similar to active tab style)
- Cards disabled when voting is stopped
- Shows "Waiting for admin..." state when voting is inactive

#### Participants & Results View (`components/poker/participants-table.tsx`)

- Table with columns: Name, Story Points (vote), Status
- **Before reveal:**

- Shows participant names
- Story Points column shows "✓" (voted) or "—" (not voted)
- Admin sees their own vote only

- **After reveal:**

- All votes visible
- Calculate and display statistics: min, max, average, consensus indicator
- Highlight outliers (votes significantly different from average)

- Observer badge for non-voting participants

#### Story Queue (`components/poker/story-queue.tsx`) - Optional

- Sidebar or collapsible section
- List of stories to estimate
- Add/remove stories
- Mark stories as complete with final estimate

---

## User Flows

### Admin Flow (Session Creator)

1. Create session → Choose scale → Start session
2. Enter story title in header
3. Click "Start Voting" → Participants select cards
4. Wait for all participants to vote (or timeout)
5. Click "Reveal Cards" → See all votes and statistics
6. Discuss outliers, reach consensus
7. Record final estimate
8. Click "New Story" → Repeat from step 2

### Participant Flow

1. Join session → Enter display name (reuse from useAuth)
2. Wait for admin to start voting
3. Select a card when voting opens
4. See "Vote submitted" confirmation
5. Wait for reveal
6. See all votes and discuss
7. Wait for next story

### Observer Flow

1. Join as observer (toggle during join)
2. See all participant actions but cannot vote
3. Useful for stakeholders, product owners watching

---

## Realtime Subscriptions

Similar to retro boards, subscribe to:

1. **Session state changes** (`poker_sessions` table)

1. `votes_revealed` toggle
1. `is_voting_active` toggle
1. `current_story` updates
1. `voting_scale` changes

1. **Participant changes** (`poker_participants` table)

1. New participants joining
1. Online/offline status
1. Participants leaving

1. **Vote submissions** (`poker_votes` table)

1. New votes (only show count/checkmark until revealed)
1. Vote updates (if user changes their vote before reveal)
1. Vote clearing (when starting new story)

---

## Key Features

### Reusing Existing Patterns

1. **Display Names:** Use `useAuth` hook's `displayName` and `updateDisplayName`
2. **Anonymous Auth:** Same pattern as retro boards - instant join, optional GitHub linking
3. **Participant System:** Reuse `retro_participants` pattern for `poker_participants`
4. **Realtime Sync:** Same Supabase channels pattern as retro boards
5. **Share Functionality:** Copy link + markdown export (session summary with all stories and estimates)
6. **Public/Private:** Same visibility toggle as retro boards

### New Functionality

1. **Vote Reveal Toggle:** Admin-controlled visibility of votes
2. **Voting State:** Start/stop voting sessions
3. **Configurable Scales:** Admin sets point range (Fibonacci, T-shirt, custom)
4. **Statistics Calculation:** Auto-calculate min, max, average, consensus after reveal
5. **Story Queue:** Track multiple stories in one session (optional v2 feature)

---

## API Routes

```plaintext
/api/poker/create → POST (create session + add creator as participant)
/api/poker/[slug]/join → POST (add participant)
/api/poker/[slug]/vote → POST (submit/update vote)
/api/poker/[slug]/reveal → POST (toggle votes_revealed)
/api/poker/[slug]/voting → POST (toggle is_voting_active)
/api/poker/[slug]/clear-votes → POST (clear all votes for new story)
```

Or use Server Actions in the client component like retro boards do.

---

## RLS Policies

Similar to retro boards:

- Public sessions: Anyone can view, participants can vote
- Private sessions: Only participants can view/vote
- Only session author can modify session state (reveal, start/stop voting)
- Participants can only update their own votes

---

## UI Design Notes

Based on the screenshot and Wayfindr design system:

**Colors:**

- Cards: Dark background with border, active card gets primary/accent color border
- Votes revealed: Use muted color for cards, highlight consensus range
- Status indicators: Green (voted), Gray (not voted), Amber (outlier after reveal)

**Typography:**

- Large, clear numbers on voting cards (text-4xl or text-5xl)
- Monospace font for vote values in table for alignment

**Layout:**

- Card grid: Responsive grid (grid-cols-3 md:grid-cols-7)
- Participants table: Clean table with alternating row colors
- Admin controls: Sticky top bar or header section

**Interactions:**

- Card selection: Scale up slightly on hover, clear selected state
- Reveal animation: Flip cards or fade-in animation when revealing votes
- Toast notifications: "Vote submitted", "Cards revealed", "New story started"

---

## Implementation Phases

**Phase 1: Core MVP**

1. Database schema + RLS policies
2. Create/join landing page
3. Basic session page with voting cards
4. Admin controls (start/stop, reveal/hide)
5. Participants table with vote display
6. Realtime sync for votes and session state

**Phase 2: Enhanced UX**

1. Statistics calculation after reveal
2. Share functionality (link + markdown)
3. Voting scale configuration
4. Observer mode
5. Polish animations and transitions

**Phase 3: Advanced Features** (Future)

1. Story queue management
2. Session history/replay
3. Export estimates to CSV/JSON
4. Timer for voting rounds
5. Integration with project management tools

---

This plan maintains consistency with r8ro's architecture while adding the unique requirements of planning poker sessions. The familiar patterns (anonymous auth, realtime collaboration, public/private modes) will make the feature feel cohesive with the existing retro boards functionality.
