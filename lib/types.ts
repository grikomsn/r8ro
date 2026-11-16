export interface RetroBoard {
  author_id: string;
  author_name: string;
  created_at: string;
  id: string;
  is_locked: boolean;
  is_public: boolean;
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
  author_id: string;
  author_name: string;
  created_at: string;
  current_story: string | null;
  id: string;
  is_public: boolean;
  is_voting_active: boolean;
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
