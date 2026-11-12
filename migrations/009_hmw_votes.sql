-- Schema V9: HMW Voting for Rooms
-- Run this in Supabase SQL Editor

-- Create hmw_votes table to store votes on HMW items
CREATE TABLE IF NOT EXISTS hmw_votes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id uuid REFERENCES research_rooms(id) ON DELETE CASCADE,
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    hmw_index integer NOT NULL,  -- Index of the HMW item in the result array
    vote integer DEFAULT 1,       -- Vote value (1 = upvote, could extend later)
    created_at timestamptz DEFAULT now(),
    
    -- Each user can only vote once per HMW item in a room
    UNIQUE(room_id, user_id, hmw_index)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_hmw_votes_room ON hmw_votes(room_id);
CREATE INDEX IF NOT EXISTS idx_hmw_votes_user ON hmw_votes(user_id);
