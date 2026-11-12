-- HMW Platform Schema V4 - Users and Research Rooms
-- Run this in Supabase SQL Editor

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  age int,
  occupation text NOT NULL,
  -- 學生專用欄位
  school text,
  department text,
  major text,
  grade text,
  -- 非學生專用欄位
  industry text,
  position text,
  highest_education_school text,
  highest_education_department text,
  highest_education_major text,
  highest_education_grade text,
  created_at timestamptz DEFAULT now()
);

-- 2. Research Rooms Table
CREATE TABLE IF NOT EXISTS research_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text UNIQUE NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  creator_id uuid REFERENCES users(id),
  name text NOT NULL,
  research_topic text NOT NULL,
  research_purpose text NOT NULL,
  team_size int DEFAULT 1,
  min_votes int DEFAULT 1,
  max_votes int DEFAULT 3,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- 3. Room Members Table
CREATE TABLE IF NOT EXISTS room_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES research_rooms(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  UNIQUE(room_id, user_id)
);

-- Index for faster room code lookup
CREATE INDEX IF NOT EXISTS idx_research_rooms_code ON research_rooms(room_code);

-- Enable RLS if needed
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;

-- Basic policies (allow all for now, refine later)
CREATE POLICY "Allow all users operations" ON users FOR ALL USING (true);
CREATE POLICY "Allow all rooms operations" ON research_rooms FOR ALL USING (true);
CREATE POLICY "Allow all room_members operations" ON room_members FOR ALL USING (true);
