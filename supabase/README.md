# Supabase Schema and RLS Policies

This directory contains the complete database schema and Row Level Security (RLS) policies for the r8ro retro app.

## Files

- `schema.sql` - Complete database schema including:
  - Helper functions (`can_access_board`)
  - Table definitions with all columns, types, and defaults
  - Foreign key constraints
  - Indexes for performance
  - Row Level Security policies for all tables

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

```bash
psql -h <your-db-host> -U postgres -d postgres -f schema.sql
```

Or use Supabase CLI:

```bash
supabase db reset
# Then apply schema.sql through Supabase dashboard or CLI
```

## Migration History

The schema has been migrated from:

- Custom TEXT user IDs → Supabase Auth UUIDs
- Simple vote counter → Vote tracking table
- No RLS → Comprehensive RLS policies
