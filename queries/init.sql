-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.retro_boards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT 'Untitled Retro'::text,
  author_id text NOT NULL,
  author_name text NOT NULL,
  is_public boolean DEFAULT true,
  timer_running boolean DEFAULT false,
  timer_seconds integer DEFAULT 0,
  timer_started_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_locked boolean DEFAULT false,
  CONSTRAINT retro_boards_pkey PRIMARY KEY (id)
);
CREATE TABLE public.retro_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL,
  column_type text NOT NULL CHECK (column_type = ANY (ARRAY['went_well'::text, 'to_improve'::text, 'action_items'::text])),
  content text NOT NULL,
  author_name text NOT NULL,
  author_id text NOT NULL,
  votes integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT retro_cards_pkey PRIMARY KEY (id),
  CONSTRAINT retro_cards_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.retro_boards(id)
);
CREATE TABLE public.retro_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL,
  user_id text NOT NULL,
  username text NOT NULL,
  is_online boolean DEFAULT true,
  joined_at timestamp with time zone DEFAULT now(),
  CONSTRAINT retro_participants_pkey PRIMARY KEY (id),
  CONSTRAINT retro_participants_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.retro_boards(id)
);
