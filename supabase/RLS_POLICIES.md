# Row Level Security (RLS) Policies Reference

This document describes all RLS policies in the r8ro retro app database.

## Overview

All tables have Row Level Security enabled. Policies use `(SELECT auth.uid())` pattern for performance optimization, ensuring `auth.uid()` is evaluated once per query rather than per row.

## Policy Details

### retro_boards

#### SELECT Policy (`boards_select_policy`)

**Access**: Users can see boards if:

- Board is public (`is_public = true`), OR
- User is the board author, OR
- User is a participant in the board

**Use Case**: Enables public boards to be visible to all authenticated users, while private boards are only visible to participants and the author.

#### INSERT Policy (`boards_insert_policy`)

**Access**: Any authenticated user can create boards
**Requirement**: `author_id` must match the authenticated user's ID

**Use Case**: Allows anonymous and authenticated users to create new retro boards.

#### UPDATE Policy (`boards_update_policy`)

**Access**: Only the board author can update board settings
**Requirement**: `author_id` must match authenticated user's ID

**Use Case**: Prevents unauthorized changes to board settings (title, visibility, lock status, timer).

#### DELETE Policy (`boards_delete_policy`)

**Access**: Only the board author can delete boards
**Requirement**: `author_id` must match authenticated user's ID

**Use Case**: Ensures only board creators can permanently delete boards.

---

### retro_participants

#### SELECT Policy (`participants_select_policy`)

**Access**: Uses `can_access_board()` helper function to check board access
**Logic**: If user can access the board (public, author, or participant), they can see participants

**Use Case**: Prevents infinite recursion while allowing participants to see each other on private boards.

#### INSERT Policy (`participants_insert_policy`)

**Access**: Users can join boards if:

- Board is public, OR
- User is the board author
  **Requirement**: `user_id` must match authenticated user's ID

**Use Case**: Allows users to join public boards or boards they created. Private boards require explicit invitation (handled by application logic).

#### UPDATE Policy (`participants_update_policy`)

**Access**: Users can only update their own participant record
**Requirement**: `user_id` must match authenticated user's ID

**Use Case**: Allows users to update their online status or username.

#### DELETE Policy (`participants_delete_policy`)

**Access**: Users can only delete their own participant record
**Requirement**: `user_id` must match authenticated user's ID

**Use Case**: Allows users to leave boards.

---

### retro_cards

#### SELECT Policy (`cards_select_policy`)

**Access**: Users can see cards if they can see the board
**Logic**: Checks board visibility (public, author, or participant)

**Use Case**: Cards inherit board visibility - if you can't see the board, you can't see its cards.

#### INSERT Policy (`cards_insert_policy`)

**Access**: Users can add cards if:

- Board is not locked OR user is board author, AND
- User can access the board (public, author, or participant)
  **Requirement**: `author_id` must match authenticated user's ID

**Use Case**: Prevents adding cards to locked boards (except by author), while allowing all participants to add cards to unlocked boards.

#### UPDATE Policy (`cards_update_policy`)

**Access**: Users can edit cards if:

- User is the card author, AND
- Board is not locked OR user is board author

**Use Case**: Allows card authors to edit their own cards, but prevents edits on locked boards (except by board author).

#### DELETE Policy (`cards_delete_policy`)

**Access**: Users can delete cards if:

- User is the card author, AND
- Board is not locked OR user is board author

**Use Case**: Allows card authors to delete their own cards, but prevents deletions on locked boards (except by board author).

---

### retro_card_votes

#### SELECT Policy (`votes_select_policy`)

**Access**: Users can see votes if they can see the card's board
**Logic**: Checks board visibility through card → board relationship

**Use Case**: Vote visibility matches board visibility.

#### INSERT Policy (`votes_insert_policy`)

**Access**: Users can vote if:

- Board is not locked OR user is board author, AND
- User can access the board (public, author, or participant)
  **Requirement**: `user_id` must match authenticated user's ID

**Use Case**: Prevents voting on locked boards (except by author), while allowing all participants to vote on unlocked boards. Unique constraint prevents duplicate votes.

#### DELETE Policy (`votes_delete_policy`)

**Access**: Users can only remove their own votes
**Requirement**: `user_id` must match authenticated user's ID

**Use Case**: Enables un-voting functionality.

---

## Helper Functions

### can_access_board(board_uuid)

**Purpose**: Check if the current user can access a board without causing RLS recursion.

**Returns**: `boolean`

**Logic**:

- Returns `true` if board is public, OR
- User is the board author, OR
- User is a participant in the board

**Security**: Uses `SECURITY DEFINER` to bypass RLS when checking participant status, preventing infinite recursion in `participants_select_policy`.

**Usage**: Used by `participants_select_policy` to determine if a user can see participant records.

---

## Permission Matrix

| Action            | Public Board       | Private Board (Participant) | Private Board (Non-Participant) | Locked Board (Author) | Locked Board (Participant) | Locked Board (Non-Participant) |
| ----------------- | ------------------ | --------------------------- | ------------------------------- | --------------------- | -------------------------- | ------------------------------ |
| View board        | ✅                 | ✅                          | ❌                              | ✅                    | ✅                         | ❌                             |
| View cards        | ✅                 | ✅                          | ❌                              | ✅                    | ✅                         | ❌                             |
| View participants | ✅                 | ✅                          | ❌                              | ✅                    | ✅                         | ❌                             |
| Create board      | ✅                 | ✅                          | ✅                              | ✅                    | ✅                         | ✅                             |
| Update board      | ❌ (unless author) | ❌ (unless author)          | ❌                              | ✅                    | ❌                         | ❌                             |
| Delete board      | ❌ (unless author) | ❌ (unless author)          | ❌                              | ✅                    | ❌                         | ❌                             |
| Join board        | ✅                 | ❌                          | ❌                              | ✅                    | ❌                         | ❌                             |
| Add card          | ✅                 | ✅                          | ❌                              | ✅                    | ❌                         | ❌                             |
| Edit own card     | ✅                 | ✅                          | ❌                              | ✅                    | ❌                         | ❌                             |
| Delete own card   | ✅                 | ✅                          | ❌                              | ✅                    | ❌                         | ❌                             |
| Vote on card      | ✅                 | ✅                          | ❌                              | ✅                    | ❌                         | ❌                             |
| Un-vote           | ✅                 | ✅                          | ❌                              | ✅                    | ❌                         | ❌                             |

---

## Security Considerations

1. **Anonymous Users**: All users must be authenticated (anonymous sign-in is used). RLS policies check `auth.uid() IS NOT NULL` for insert operations.

2. **Performance**: All policies use `(SELECT auth.uid())` pattern to ensure `auth.uid()` is evaluated once per query, not per row.

3. **Recursion Prevention**: The `can_access_board()` function uses `SECURITY DEFINER` to prevent infinite recursion when checking participant status in `participants_select_policy`.

4. **Data Integrity**: Foreign key constraints ensure referential integrity, and unique constraints prevent duplicate votes and participant records.

5. **Cascade Deletes**: All foreign keys use `ON DELETE CASCADE` to ensure data consistency when users or boards are deleted.
