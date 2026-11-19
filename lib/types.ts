export interface RetroBoard {
  /** Set when the board was filed away; it does not change access. */
  archived_at: string | null;
  author_id: string;
  author_name: string;
  created_at: string;
  id: string;
  is_locked: boolean;
  is_public: boolean;
  /** Organization that owns the board, or null for a personal board. */
  org_id: string | null;
  slug: string;
  /** Seconds left when the timer was paused part way, otherwise null. */
  timer_remaining_seconds: number | null;
  timer_running: boolean;
  /** Configured timer duration in seconds. */
  timer_seconds: number;
  timer_started_at: string | null;
  title: string;
  updated_at: string;
}

export interface RetroCard {
  author_id: string;
  author_name: string;
  board_id: string;
  column_type: "went_well" | "to_improve" | "action_items";
  content: string;
  created_at: string;
  id: string;
  votes: number;
}

export interface RetroParticipant {
  board_id: string;
  id: string;
  is_online: boolean;
  joined_at: string;
  user_id: string;
  username: string;
}

export type ColumnType = "went_well" | "to_improve" | "action_items";

export interface PokerSession {
  /** Set when the session was filed away; it does not change access. */
  archived_at: string | null;
  author_id: string;
  author_name: string;
  created_at: string;
  current_story: string | null;
  id: string;
  is_public: boolean;
  is_voting_active: boolean;
  /** Organization that owns the session, or null for a personal session. */
  org_id: string | null;
  slug: string;
  title: string;
  updated_at: string;
  votes_revealed: boolean;
  voting_scale: string[];
}

export interface PokerParticipant {
  /** Maintained by the database; true when the participant has a vote. */
  has_voted: boolean;
  id: string;
  is_observer: boolean;
  is_online: boolean;
  joined_at: string;
  session_id: string;
  user_id: string;
  username: string;
}

export interface PokerVote {
  created_at: string;
  id: string;
  session_id: string;
  user_id: string;
  vote_value: string;
}

export interface PokerRoundVote {
  username: string;
  value: string;
}

export interface PokerRound {
  created_at: string;
  estimate: string | null;
  id: string;
  session_id: string;
  story: string | null;
  votes: PokerRoundVote[];
}

export type SessionKind = "retro" | "poker";

export type OrganizationRole = "owner" | "admin" | "member";

export interface Organization {
  created_at: string;
  created_by: string | null;
  id: string;
  name: string;
  slug: string;
  updated_at: string;
}

/** A row of `list_my_organizations()`. */
export interface OrganizationSummary {
  created_at: string;
  id: string;
  joined_at: string;
  member_count: number;
  name: string;
  role: OrganizationRole;
  slug: string;
}

/** A row of `list_organization_members()`. */
export interface OrganizationMember {
  avatar_url: string | null;
  display_name: string | null;
  github_username: string | null;
  joined_at: string;
  role: OrganizationRole;
  user_id: string;
}

export interface OrganizationInvite {
  code: string;
  created_at: string;
  created_by: string | null;
  expires_at: string | null;
  org_id: string;
}

/** A row of `get_organization_invite()`, readable without membership. */
export interface OrganizationInvitePreview {
  is_expired: boolean;
  is_member: boolean;
  member_count: number;
  org_id: string;
  org_name: string;
  org_slug: string;
}

/** A row of `list_my_sessions()`. */
export interface ManagedSession {
  archived_at: string | null;
  author_id: string;
  author_name: string;
  can_manage: boolean;
  created_at: string;
  id: string;
  is_author: boolean;
  /** Null for poker sessions, which cannot be locked. */
  is_locked: boolean | null;
  is_participant: boolean;
  is_public: boolean;
  /** Cards on a retro board, or estimated rounds in a poker session. */
  item_count: number;
  kind: SessionKind;
  org_id: string | null;
  org_name: string | null;
  org_slug: string | null;
  participant_count: number;
  slug: string;
  title: string;
}
