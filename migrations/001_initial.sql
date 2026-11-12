-- Minimal MVP schema for AI HMW Platform (run in Supabase SQL Editor)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  owner_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  uploader_id uuid,
  filename text,
  content_type text,
  storage_path text,
  size bigint,
  status text DEFAULT 'uploaded',
  meta jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  file_id uuid REFERENCES files(id) ON DELETE SET NULL,
  speaker text,
  content text NOT NULL,
  start_time double precision,
  end_time double precision,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prompt_steps (
  id serial PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  step_index int NOT NULL,
  title text,
  prompt_text text NOT NULL,
  prompt_image_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analysis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  initiator_id uuid,
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  finished_at timestamptz,
  meta jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmw_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_run_id uuid REFERENCES analysis_runs(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  score numeric,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmw_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hmw_id uuid REFERENCES hmw_candidates(id) ON DELETE CASCADE,
  transcript_id uuid REFERENCES transcripts(id) ON DELETE SET NULL,
  speaker text,
  excerpt text NOT NULL,
  context jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  name text,
  max_votes_per_user int DEFAULT 3,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  user_id text,
  display_name text,
  joined_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES participants(id) ON DELETE CASCADE,
  hmw_id uuid REFERENCES hmw_candidates(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_votes_room_hmw ON public.votes(room_id, hmw_id);