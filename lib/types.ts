export interface RetroBoard {
  id: string
  slug: string
  title: string
  author_id: string
  author_name: string
  is_public: boolean
  is_locked: boolean
  timer_running: boolean
  timer_seconds: number
  timer_started_at: string | null
  created_at: string
  updated_at: string
}

export interface RetroCard {
  id: string
  board_id: string
  column_type: "went_well" | "to_improve" | "action_items"
  content: string
  author_name: string
  author_id: string
  votes: number
  created_at: string
}

export interface RetroParticipant {
  id: string
  board_id: string
  user_id: string
  username: string
  is_online: boolean
  joined_at: string
}

export type ColumnType = "went_well" | "to_improve" | "action_items"
