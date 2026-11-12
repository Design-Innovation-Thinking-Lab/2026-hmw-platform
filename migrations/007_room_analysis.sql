-- Schema V7: Room Analysis Integration
-- Run this in Supabase SQL Editor

-- 1. Add room_id to analysis_runs for room-based analysis
ALTER TABLE analysis_runs ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES research_rooms(id) ON DELETE CASCADE;

-- 2. Add analysis_status to research_rooms to track room analysis state
-- Values: 'pending' (default) | 'analyzing' | 'completed' | 'error'
ALTER TABLE research_rooms ADD COLUMN IF NOT EXISTS analysis_status text DEFAULT 'pending';

-- 3. Add current_analysis_run_id to track active analysis
ALTER TABLE research_rooms ADD COLUMN IF NOT EXISTS current_analysis_run_id uuid REFERENCES analysis_runs(id) ON DELETE SET NULL;

-- Index for faster room analysis lookup
CREATE INDEX IF NOT EXISTS idx_analysis_runs_room_id ON analysis_runs(room_id);
