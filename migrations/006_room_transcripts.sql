-- Schema V6: Room Transcripts
-- Run this in Supabase SQL Editor

-- 1. Transcripts Table - stores uploaded transcripts per room
CREATE TABLE IF NOT EXISTS room_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES research_rooms(id) ON DELETE CASCADE,
  uploader_id uuid REFERENCES users(id),
  file_name text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Index for faster room lookup
CREATE INDEX IF NOT EXISTS idx_room_transcripts_room_id ON room_transcripts(room_id);

-- Enable RLS
ALTER TABLE room_transcripts ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (refine later)
CREATE POLICY "Allow all room_transcripts operations" ON room_transcripts FOR ALL USING (true);
