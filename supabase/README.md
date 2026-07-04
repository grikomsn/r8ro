# Supabase Schema and RLS Policies

This directory contains the fresh-project retro baseline, subsequent
migrations, and Row Level Security (RLS) documentation for r8ro.

## Files

- `schema.sql` - Retro baseline including:
  - Helper functions (`can_access_board`)
  - Table definitions with all columns, types, and defaults
  - Foreign key constraints
  - Indexes for performance
- `migrations/` - Poker tables, Realtime configuration, later policy changes,
  and account-linking support
- `RLS_POLICIES.md` - Current policy reference

## Schema Overview

### Tables

1. **retro_boards** - Retrospective board sessions
   - Stores board metadata, visibility settings, and timer state
   - Author is stored as UUID referencing `auth.users`

2. **retro_cards** - Individual cards/items in retro boards
   - Belongs to a board and has a column type (went_well, to_improve, action_items)
   - Author is stored as UUID referencing `auth.users`
   - Note: `votes` column is legacy and kept for compatibility, actual votes are tracked in `retro_card_votes`

3. **retro_participants** - Users participating in boards
   - Tracks who has joined each board
   - Unique constraint ensures one participant record per user per board

4. **retro_card_votes** - Individual votes on cards
   - Junction table tracking who voted on which cards
   - Unique constraint ensures one vote per user per card
   - Enables vote/unvote functionality

5. **poker_sessions** - Scrum poker session configuration and voting state

6. **poker_participants** - Poker participants, observers, and presence

7. **poker_votes** - One estimate per participant and session

### RLS Policies

All tables have Row Level Security enabled with policies enforcing:

- **Public boards**: Any authenticated user can view, join, add cards, and vote
- **Private boards**: Only participants can access
- **Locked boards**: Only author can write, others read-only
- **Card operations**: Users can only edit/delete their own cards
- **Vote operations**: One vote per user per card, users can un-vote

### Helper Functions

- `can_access_board(board_uuid)` - SECURITY DEFINER function to check board access without RLS recursion

## Usage

To apply this schema to a fresh Supabase database:

1. Apply `schema.sql`.
2. Apply every SQL file in `migrations/` in filename order.
3. Enable anonymous authentication and configure OAuth redirect URLs.

Use the Supabase SQL Editor for a hosted project or the connection information
from `supabase status` for a local CLI stack. Never commit connection strings,
service-role keys, or a production project reference.

## Migration History

The schema has been migrated from:

- Custom TEXT user IDs → Supabase Auth UUIDs
- Simple vote counter → Vote tracking table
- No RLS → Comprehensive RLS policies
