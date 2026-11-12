-- Schema V16: Add analysis_run_id to hmw_votes for multi-mode analysis support
-- Run this in Supabase SQL Editor

-- Add analysis_run_id column to hmw_votes
ALTER TABLE hmw_votes 
ADD COLUMN IF NOT EXISTS analysis_run_id uuid REFERENCES analysis_runs(id) ON DELETE CASCADE;

-- Create index for faster queries by run
CREATE INDEX IF NOT EXISTS idx_hmw_votes_run ON hmw_votes(analysis_run_id);

-- Update unique constraint to include analysis_run_id
-- First drop the old constraint
ALTER TABLE hmw_votes DROP CONSTRAINT IF EXISTS hmw_votes_room_id_user_id_hmw_index_key;

-- Add new unique constraint
ALTER TABLE hmw_votes 
ADD CONSTRAINT hmw_votes_room_id_user_id_hmw_index_run_key 
UNIQUE(room_id, user_id, hmw_index, analysis_run_id);
