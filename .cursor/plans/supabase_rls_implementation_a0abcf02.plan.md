---
name: Supabase RLS Implementation
overview: Implement Row Level Security policies from scratch for the realtime retro app, migrating to Supabase Auth UIDs and adding proper vote tracking with granular access control for public, private, and locked boards.
todos:
  - id: schema-migration
    content: Create migration with UUID columns, vote table, and constraints
    status: completed
  - id: rls-policies
    content: Implement all RLS policies for boards, cards, participants, votes
    status: completed
    dependencies:
      - schema-migration
  - id: data-migration
    content: Handle existing data migration from TEXT to UUID user_ids
    status: completed
    dependencies:
      - schema-migration
  - id: update-auth-flow
    content: Update board creation and user identification to use auth.uid()
    status: completed
    dependencies:
      - data-migration
  - id: implement-vote-tracking
    content: Replace simple counter with vote table logic and un-voting
    status: completed
    dependencies:
      - rls-policies
      - update-auth-flow
  - id: update-realtime-subs
    content: Add retro_card_votes subscription and update vote count display
    status: completed
    dependencies:
      - implement-vote-tracking
  - id: test-permissions
    content: Test all public/private/locked board permission scenarios
    status: completed
    dependencies:
      - update-realtime-subs
  - id: security-review
    content: Run Supabase security advisors and verify RLS coverage
    status: completed
    dependencies:
      - test-permissions
---

# Supabase RLS Implementation Plan

## Overview

Implement comprehensive Row Level Security for the retro app with anonymous-first authentication, GitHub account linking, and granular permissions for public/private/locked boards.

## Architecture Changes

### User Identification Migration

**Current:** Custom TEXT user IDs generated client-side**Target:** Supabase Auth UUIDs (`auth.uid()`)This enables:

- Proper RLS policies using `auth.uid()`
- Seamless anonymous → GitHub account linking (same UUID persists)
- Standard Supabase auth patterns

### Vote Tracking Enhancement

**Current:** Simple `votes` integer counter (unlimited votes)**Target:** `retro_card_votes` junction table tracking individual votesThis enables:

- One vote per user per card
- Un-voting capability
- RLS policies preventing duplicate votes

### Access Control Strategy

**Private boards:** Access determined by `retro_participants` table membership**Public boards:** All authenticated users can access**Locked boards:** Write access restricted to board author---

## Database Schema Changes

### 1. Update Existing Tables

**[supabase/migrations/add_rls_and_schema_changes.sql](supabase/migrations/add_rls_and_schema_changes.sql)**Modify columns from TEXT to UUID with foreign keys to auth.users:

```sql
-- retro_boards
ALTER TABLE retro_boards
  ALTER COLUMN author_id TYPE uuid USING author_id::uuid,
  ADD CONSTRAINT retro_boards_author_fkey
    FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- retro_cards
ALTER TABLE retro_cards
  ALTER COLUMN author_id TYPE uuid USING author_id::uuid,
  ADD CONSTRAINT retro_cards_author_fkey
    FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- retro_participants
ALTER TABLE retro_participants
  ALTER COLUMN user_id TYPE uuid USING user_id::uuid,
  ADD CONSTRAINT retro_participants_user_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
```

### 2. Add Vote Tracking Table

Create `retro_card_votes` with composite unique constraint:

```sql
CREATE TABLE retro_card_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES retro_cards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(card_id, user_id)
);
CREATE INDEX idx_retro_card_votes_card_id ON retro_card_votes(card_id);
CREATE INDEX idx_retro_card_votes_user_id ON retro_card_votes(user_id);
```

### 3. Add Unique Constraint for Participants

Ensure one participant record per user per board:

```sql
ALTER TABLE retro_participants
  ADD CONSTRAINT retro_participants_board_user_unique
    UNIQUE(board_id, user_id);
```

---

## RLS Policies

### retro_boards

Enable RLS and create policies:

```sql
ALTER TABLE retro_boards ENABLE ROW LEVEL SECURITY;

-- SELECT: Public boards OR private boards where user is participant OR user is author
CREATE POLICY "boards_select_policy" ON retro_boards FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      is_public = true
      OR author_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM retro_participants
        WHERE board_id = retro_boards.id AND user_id = auth.uid()
      )
    )
  );

-- INSERT: Any authenticated user can create boards
CREATE POLICY "boards_insert_policy" ON retro_boards FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND author_id = auth.uid());

-- UPDATE: Only board author can update
CREATE POLICY "boards_update_policy" ON retro_boards FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- DELETE: Only board author can delete
CREATE POLICY "boards_delete_policy" ON retro_boards FOR DELETE
  USING (auth.uid() = author_id);
```

### retro_participants

```sql
ALTER TABLE retro_participants ENABLE ROW LEVEL SECURITY;

-- SELECT: Can see participants if you can see the board
CREATE POLICY "participants_select_policy" ON retro_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM retro_boards
      WHERE id = board_id AND (
        is_public = true
        OR author_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM retro_participants rp
          WHERE rp.board_id = retro_boards.id AND rp.user_id = auth.uid()
        )
      )
    )
  );

-- INSERT: Can join public boards OR boards you're invited to
CREATE POLICY "participants_insert_policy" ON retro_participants FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM retro_boards
      WHERE id = board_id AND (
        is_public = true
        OR author_id = auth.uid()
      )
    )
  );

-- UPDATE: Can update own participant record
CREATE POLICY "participants_update_policy" ON retro_participants FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: Can leave boards (delete own participant record)
CREATE POLICY "participants_delete_policy" ON retro_participants FOR DELETE
  USING (auth.uid() = user_id);
```

### retro_cards

```sql
ALTER TABLE retro_cards ENABLE ROW LEVEL SECURITY;

-- SELECT: Can see cards if you can see the board
CREATE POLICY "cards_select_policy" ON retro_cards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM retro_boards
      WHERE id = board_id AND (
        is_public = true
        OR author_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM retro_participants
          WHERE board_id = retro_boards.id AND user_id = auth.uid()
        )
      )
    )
  );

-- INSERT: Can add cards if board not locked OR you're the author
CREATE POLICY "cards_insert_policy" ON retro_cards FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM retro_boards
      WHERE id = board_id
        AND (is_locked = false OR author_id = auth.uid())
        AND (
          is_public = true
          OR author_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM retro_participants
            WHERE board_id = retro_boards.id AND user_id = auth.uid()
          )
        )
    )
  );

-- UPDATE: Can edit own cards if board not locked OR you're board author
CREATE POLICY "cards_update_policy" ON retro_cards FOR UPDATE
  USING (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM retro_boards
      WHERE id = board_id AND (is_locked = false OR author_id = auth.uid())
    )
  )
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM retro_boards
      WHERE id = board_id AND (is_locked = false OR author_id = auth.uid())
    )
  );

-- DELETE: Can delete own cards if board not locked OR you're board author
CREATE POLICY "cards_delete_policy" ON retro_cards FOR DELETE
  USING (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM retro_boards
      WHERE id = board_id AND (is_locked = false OR author_id = auth.uid())
    )
  );
```

### retro_card_votes

```sql
ALTER TABLE retro_card_votes ENABLE ROW LEVEL SECURITY;

-- SELECT: Can see votes if you can see the card's board
CREATE POLICY "votes_select_policy" ON retro_card_votes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM retro_cards
      JOIN retro_boards ON retro_cards.board_id = retro_boards.id
      WHERE retro_cards.id = card_id AND (
        retro_boards.is_public = true
        OR retro_boards.author_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM retro_participants
          WHERE board_id = retro_boards.id AND user_id = auth.uid()
        )
      )
    )
  );

-- INSERT: Can vote if board accessible and not locked (or you're author)
CREATE POLICY "votes_insert_policy" ON retro_card_votes FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM retro_cards
      JOIN retro_boards ON retro_cards.board_id = retro_boards.id
      WHERE retro_cards.id = card_id
        AND (retro_boards.is_locked = false OR retro_boards.author_id = auth.uid())
        AND (
          retro_boards.is_public = true
          OR retro_boards.author_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM retro_participants
            WHERE board_id = retro_boards.id AND user_id = auth.uid()
          )
        )
    )
  );

-- DELETE: Can remove own votes
CREATE POLICY "votes_delete_policy" ON retro_card_votes FOR DELETE
  USING (auth.uid() = user_id);
```

---

## Application Code Updates

### 1. Remove Custom ID Generation

**Files:** [`lib/utils/slug.ts`](lib/utils/slug.ts), [`app/new/route.ts`](app/new/route.ts)

- Remove `generateUserId()` function
- Use `auth.uid()` from Supabase session instead
- Ensure anonymous users are signed in before creating boards

### 2. Update useAuth Hook

**File:** [`hooks/use-auth.ts`](hooks/use-auth.ts)Current state already uses Supabase Auth properly. Ensure all components use `user.id` from auth context.

### 3. Update Board Creation Flow

**File:** [`app/new/route.ts`](app/new/route.ts)

```typescript
// Get authenticated user
const {
  data: { user },
  error: authError,
} = await supabase.auth.getUser();
if (!user) throw new Error("Not authenticated");

// Use user.id for author_id
const { data: board, error } = await supabase.from("retro_boards").insert({
  slug,
  title: "Untitled Retro",
  author_id: user.id, // UUID from auth
  author_name: authorName,
  // ...
});
```

### 4. Update Voting Logic

**Files:** [`app/retro/[slug]/RetroPageClient.tsx`](app/retro/[slug]/RetroPageClient.tsx), [`components/retro/retro-column.tsx`](components/retro/retro-column.tsx)Replace vote increment with vote toggle:

```typescript
// Check if user already voted
const { data: existingVote } = await supabase
  .from("retro_card_votes")
  .select("id")
  .eq("card_id", cardId)
  .eq("user_id", userId)
  .single();

if (existingVote) {
  // Un-vote
  await supabase.from("retro_card_votes").delete().eq("id", existingVote.id);
} else {
  // Vote
  await supabase
    .from("retro_card_votes")
    .insert({ card_id: cardId, user_id: userId });
}
```

### 5. Update Card Vote Counts

Use computed vote counts from `retro_card_votes`:

```typescript
const { data: cards } = await supabase
  .from("retro_cards")
  .select(
    `
    *,
    vote_count:retro_card_votes(count)
  `,
  )
  .eq("board_id", boardId);
```

Or create a Postgres function/view for efficient vote counting.

### 6. Update Realtime Subscriptions

**File:** [`app/retro/[slug]/RetroPageClient.tsx`](app/retro/[slug]/RetroPageClient.tsx)Add subscription for `retro_card_votes` table:

```typescript
supabase
  .channel("retro_changes")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "retro_card_votes" },
    handleVoteChange,
  )
  .subscribe();
```

---

## Data Migration Strategy

Since existing boards use custom TEXT IDs that don't exist in `auth.users`, we need to handle existing data:

### Option A: Fresh Start (Recommended for Dev)

Drop existing data and start fresh with proper auth UIDs.

### Option B: Create Mapping

- Create anonymous Supabase users for each unique TEXT user_id
- Map old TEXT IDs to new auth UIDs
- Update all foreign key references

For production, implement Option B with a migration script that:

1. Gets all unique user_ids from all tables
2. Creates anonymous Supabase users for each
3. Creates id_mapping table
4. Updates all references

---

## Testing Checklist

### Anonymous Auth Flow

- User auto-signs in anonymously on first visit
- User can create boards
- User can join public boards
- User cannot access private boards without joining

### GitHub Linking Flow

- Anonymous user links GitHub account
- Same user ID persists after linking
- User retains access to all previous boards/cards

### Board Permissions

- **Public boards:** Anyone can view, join, add cards, vote, edit/delete own cards
- **Private boards:** Only participants can access, other authenticated users cannot see
- **Locked boards:** Only author can add/edit/delete cards, others read-only

### Card Operations

- Users can only edit/delete their own cards
- Users can vote once per card
- Users can un-vote their own votes
- Vote counts update in realtime

### Author-Only Operations

- Only board author can update board settings (public/private, locked/unlocked)
- Only board author can delete the board

---

## Implementation Steps

1. Create migration file with schema changes and RLS policies
2. Handle existing data (choose Option A or B)
3. Update application code to use `auth.uid()`
