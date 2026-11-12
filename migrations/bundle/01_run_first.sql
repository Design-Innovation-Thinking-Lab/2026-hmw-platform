-- ═══════════════════════════════════════════════════════════════════════════
-- AI HMW Platform — 資料庫建置 第 1 份：建立資料表結構
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 使用方式：整檔複製，貼進 Supabase Dashboard → SQL Editor → Run。
--
-- ⚠️ 這份跑完、確認成功之後，才可以執行第 2 份。
--    原因：最後的 020 用 ALTER TYPE ... ADD VALUE 新增 enum 值，Postgres 規定
--    新增的 enum 值必須等該交易 commit 之後才能被使用，而第 2 份的 021 會用到它們。
--    SQL Editor 每按一次 Run 就是一個交易，所以分兩次跑即可。
--
-- 本檔由 migrations/ 內的下列檔案依序合併而成（內容完全相同）：
--   001_initial.sql
--   002_analysis_engine.sql
--   003_usage.sql
--   004_users_rooms.sql
--   005_login.sql
--   006_room_transcripts.sql
--   007_room_analysis.sql
--   008_default_project.sql
--   009_hmw_votes.sql
--   010_usage_summary.sql
--   011_analysis_results_tokens.sql
--   012_project_created_by_admin.sql
--   013_auth_email.sql
--   014_enable_rls_all_tables.sql
--   015_user_roles.sql
--   016_project_ownership.sql
--   017_hmw_votes_run_id.sql
--   018_step_attachments.sql
--   019_daily_quota.sql
--   020_role_permissions_part1.sql
-- ═══════════════════════════════════════════════════════════════════════════


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  001_initial.sql                                                      ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

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


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  002_analysis_engine.sql                                              ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- 002_analysis_engine.sql
-- 功能：分析引擎核心資料表（AI 角色、分析步驟、分析結果）+ 補齊後續版本遺漏的欄位
-- 影響資料表：analysis_roles（新）、analysis_flow_steps（新）、analysis_results（新）、
--            projects / analysis_runs / files / transcripts（欄位新增）
-- 回滾方式：DROP TABLE analysis_results, analysis_flow_steps, analysis_roles CASCADE;
--
-- 背景：原本的 schema_v2.sql 在專案第一個 commit 時被覆蓋成單行 ALTER TABLE，
--       這三張表的 CREATE TABLE 語句從此遺失，但程式碼一直在用。
--       本檔案依照正式環境 Supabase 的實際結構重建，欄位名稱與型別完全對應。
--       所有語句皆為 IF NOT EXISTS，在既有環境重跑不會有副作用。

-- ═══ 1. analysis_roles — AI 分析角色（system prompt）═══════════════════

CREATE TABLE IF NOT EXISTS analysis_roles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid REFERENCES projects(id) ON DELETE CASCADE,
  name          text NOT NULL,
  description   text,
  system_prompt text NOT NULL,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_roles_project ON analysis_roles(project_id);

-- ═══ 2. analysis_flow_steps — 分析流程步驟（prompt 模板）═══════════════

CREATE TABLE IF NOT EXISTS analysis_flow_steps (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid REFERENCES projects(id) ON DELETE CASCADE,
  step_index          integer NOT NULL,
  title               text NOT NULL,
  prompt_template     text NOT NULL,        -- Nunjucks 模板，可用變數見 docs/prompt-variables-guide.md
  analysis_scope      text NOT NULL,        -- 'individual'（逐檔分析）| 'collective'（彙整全部檔案）
  output_schema       jsonb,
  role_id             uuid REFERENCES analysis_roles(id) ON DELETE SET NULL,
  is_active           boolean DEFAULT true,
  prompt_image_url    text,
  input_step_indices  integer[],            -- 這一步可讀取前面哪幾步的輸出
  evaluation_criteria text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_flow_steps_project ON analysis_flow_steps(project_id, step_index);

-- ═══ 3. analysis_results — 每個步驟的 AI 輸出 ═══════════════════════════

CREATE TABLE IF NOT EXISTS analysis_results (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid REFERENCES projects(id) ON DELETE CASCADE,
  analysis_run_id   uuid REFERENCES analysis_runs(id) ON DELETE CASCADE,
  step_id           uuid REFERENCES analysis_flow_steps(id) ON DELETE SET NULL,
  file_id           uuid REFERENCES files(id) ON DELETE SET NULL,
  result_json       jsonb NOT NULL,
  status            text DEFAULT 'success',
  prompt_tokens     integer,
  completion_tokens integer,
  total_tokens      integer,
  execution_time_ms integer,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_results_run  ON analysis_results(analysis_run_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_step ON analysis_results(step_id);

-- ═══ 4. 補齊正式環境有、但先前 migration 未涵蓋的欄位 ═══════════════════
-- 這些欄位在正式環境都存在。其中少數是尚未發布的功能在用（已標註），
-- 一併建立可讓你的環境與正式環境結構一致，將來拉新功能不必再補。

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS status     text DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS skill_meta jsonb;          -- 尚未發布的功能使用

ALTER TABLE analysis_runs
  -- 以下三欄支援「從某一步重新分析」，為尚未發布的功能
  ADD COLUMN IF NOT EXISTS parent_run_id   uuid REFERENCES analysis_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS run_version     integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rerun_from_step integer;

ALTER TABLE files
  ADD COLUMN IF NOT EXISTS speaker_name   text,
  -- rooms / participants 是舊架構的表（001 建立，現行程式碼已不使用），
  -- 這兩個 FK 僅為與正式環境結構一致而保留
  ADD COLUMN IF NOT EXISTS room_id        uuid REFERENCES rooms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS participant_id uuid REFERENCES participants(id) ON DELETE SET NULL;

ALTER TABLE transcripts
  ADD COLUMN IF NOT EXISTS sequence integer;


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  003_usage.sql                                                        ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- Schema migration: Add usage tracking columns to analysis_results
-- Run this in Supabase SQL Editor

-- Add usage tracking columns to analysis_results
ALTER TABLE analysis_results 
ADD COLUMN IF NOT EXISTS prompt_tokens int DEFAULT 0,
ADD COLUMN IF NOT EXISTS completion_tokens int DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_tokens int DEFAULT 0,
ADD COLUMN IF NOT EXISTS execution_time_ms int DEFAULT 0;

-- Add usage summary to analysis_runs
ALTER TABLE analysis_runs
ADD COLUMN IF NOT EXISTS usage_summary jsonb;


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  004_users_rooms.sql                                                  ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

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


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  005_login.sql                                                        ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- Schema V5: Add login credentials
-- Run this in Supabase SQL Editor

-- Add student_id and verification_password columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS student_id text,
ADD COLUMN IF NOT EXISTS verification_password text;

-- Create unique index on student_id (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_student_id 
ON users(student_id) 
WHERE student_id IS NOT NULL;


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  006_room_transcripts.sql                                             ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

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


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  007_room_analysis.sql                                                ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

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


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  008_default_project.sql                                              ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- Schema V8: Default Project for Rooms
-- Add is_default column to projects table
-- Only one project can be default at a time

ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;

-- Create index for default project lookup
CREATE INDEX IF NOT EXISTS idx_projects_is_default ON projects(is_default) WHERE is_default = true;

-- Ensure only one project can be default (enforced at application level)


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  009_hmw_votes.sql                                                    ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

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

-- 補充（原始 009 遺漏）：014_enable_rls_all_tables.sql 幫其他表開 RLS 時漏列了
-- hmw_votes，導致它沒開 RLS 又被 PostgREST 自動曝光，任何拿到 anon key 的人可
-- 以直接讀寫。比照同一支腳本對其他表的處理方式補上（開 RLS + 全部允許的
-- policy），跟其他表的安全程度一致，不影響走 service_role 的後端邏輯。
ALTER TABLE hmw_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all hmw_votes operations"
  ON hmw_votes FOR ALL USING (true) WITH CHECK (true);


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  010_usage_summary.sql                                                ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- Schema V10: Add missing columns to analysis_runs table
-- Run this in Supabase SQL Editor

-- Add usage_summary column to store token usage statistics
ALTER TABLE analysis_runs 
ADD COLUMN IF NOT EXISTS usage_summary jsonb DEFAULT NULL;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'analysis_runs' 
AND column_name = 'usage_summary';


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  011_analysis_results_tokens.sql                                      ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- Schema V11: Add missing columns to analysis_results table
-- Run this in Supabase SQL Editor

-- Add token usage columns
ALTER TABLE analysis_results 
ADD COLUMN IF NOT EXISTS prompt_tokens integer DEFAULT NULL;

ALTER TABLE analysis_results 
ADD COLUMN IF NOT EXISTS completion_tokens integer DEFAULT NULL;

ALTER TABLE analysis_results 
ADD COLUMN IF NOT EXISTS total_tokens integer DEFAULT NULL;

ALTER TABLE analysis_results 
ADD COLUMN IF NOT EXISTS execution_time_ms integer DEFAULT NULL;

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'analysis_results' 
AND column_name IN ('prompt_tokens', 'completion_tokens', 'total_tokens', 'execution_time_ms');


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  012_project_created_by_admin.sql                                     ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- 012_project_created_by_admin.sql
-- 功能：projects.created_by（專案擁有者）+ users.is_admin（後台存取旗標）
-- 註：users.is_admin 原本在舊的 schema_v2.sql，但 users 表要到 004 才建立，故合併於此。

-- 1. Add created_by column to projects table for ownership
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);

-- 2. Add is_admin column to users table for backend access
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin) WHERE is_admin = TRUE;

-- 3. After running the above, set your admin user:
-- Find your user ID first:
-- SELECT id, name, email FROM users;

-- Then grant admin access:
-- UPDATE users SET is_admin = TRUE WHERE id = 'YOUR-USER-UUID-HERE';


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  013_auth_email.sql                                                   ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- =============================================
-- Schema V12: Add email and verification_password columns
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Add email column to users table (for non-student login)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email text UNIQUE;

-- 2. Add verification_password column if not exists
-- (This column may already exist from schema_v5, but we ensure it's there)
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_password text;

-- 3. Create index for email lookup
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 4. Create index for student_id lookup (if not exists)
CREATE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id);

-- =============================================
-- 現有使用者資料遷移
-- =============================================

-- 1. 為現有學生用戶設定驗證密碼（使用學號作為預設密碼）
UPDATE users 
SET verification_password = student_id 
WHERE occupation = 'student' AND verification_password IS NULL AND student_id IS NOT NULL;

-- 2. （原環境的一次性資料修正，已移除）
--    原本會把沒有 email 的非學生用戶統一填成原維護者的信箱。
--    新環境沒有舊資料，不需要執行。若日後有需要，自行填入信箱後再跑：
-- UPDATE users SET email = '<admin-email>' WHERE occupation != 'student' AND email IS NULL;

-- =============================================
-- 注意事項
-- =============================================
-- 
-- 1. 學生預設密碼 = 學號，建議提醒使用者登入後修改密碼
-- 3. 如有重複 email 錯誤，需先手動處理再執行
-- =============================================


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  014_enable_rls_all_tables.sql                                        ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- Schema: Enable RLS and Policies for All Tables
-- Run this in Supabase SQL Editor
-- This script enables Row Level Security on all tables that were missing RLS

-- ============================================
-- PART 1: ENABLE RLS ON ALL TABLES
-- ============================================

-- Tables from schema_initial.sql (missing RLS)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmw_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmw_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Tables from schema_v2.sql (missing RLS)
ALTER TABLE analysis_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_flow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PART 2: DROP EXISTING POLICIES (if any) AND CREATE NEW ONES
-- ============================================
-- Since your app uses service_role key for most operations,
-- we create permissive policies that allow all operations.

-- Projects
DROP POLICY IF EXISTS "Allow all projects operations" ON projects;
CREATE POLICY "Allow all projects operations" 
  ON projects FOR ALL USING (true) WITH CHECK (true);

-- Files
DROP POLICY IF EXISTS "Allow all files operations" ON files;
CREATE POLICY "Allow all files operations" 
  ON files FOR ALL USING (true) WITH CHECK (true);

-- Transcripts
DROP POLICY IF EXISTS "Allow all transcripts operations" ON transcripts;
CREATE POLICY "Allow all transcripts operations" 
  ON transcripts FOR ALL USING (true) WITH CHECK (true);

-- Prompt Steps
DROP POLICY IF EXISTS "Allow all prompt_steps operations" ON prompt_steps;
CREATE POLICY "Allow all prompt_steps operations" 
  ON prompt_steps FOR ALL USING (true) WITH CHECK (true);

-- Analysis Runs
DROP POLICY IF EXISTS "Allow all analysis_runs operations" ON analysis_runs;
CREATE POLICY "Allow all analysis_runs operations" 
  ON analysis_runs FOR ALL USING (true) WITH CHECK (true);

-- HMW Candidates
DROP POLICY IF EXISTS "Allow all hmw_candidates operations" ON hmw_candidates;
CREATE POLICY "Allow all hmw_candidates operations" 
  ON hmw_candidates FOR ALL USING (true) WITH CHECK (true);

-- HMW Sources
DROP POLICY IF EXISTS "Allow all hmw_sources operations" ON hmw_sources;
CREATE POLICY "Allow all hmw_sources operations" 
  ON hmw_sources FOR ALL USING (true) WITH CHECK (true);

-- Rooms (legacy)
DROP POLICY IF EXISTS "Allow all rooms operations" ON rooms;
CREATE POLICY "Allow all rooms operations" 
  ON rooms FOR ALL USING (true) WITH CHECK (true);

-- Participants
DROP POLICY IF EXISTS "Allow all participants operations" ON participants;
CREATE POLICY "Allow all participants operations" 
  ON participants FOR ALL USING (true) WITH CHECK (true);

-- Votes
DROP POLICY IF EXISTS "Allow all votes operations" ON votes;
CREATE POLICY "Allow all votes operations" 
  ON votes FOR ALL USING (true) WITH CHECK (true);

-- Analysis Roles
DROP POLICY IF EXISTS "Allow all analysis_roles operations" ON analysis_roles;
CREATE POLICY "Allow all analysis_roles operations" 
  ON analysis_roles FOR ALL USING (true) WITH CHECK (true);

-- Analysis Flow Steps
DROP POLICY IF EXISTS "Allow all analysis_flow_steps operations" ON analysis_flow_steps;
CREATE POLICY "Allow all analysis_flow_steps operations" 
  ON analysis_flow_steps FOR ALL USING (true) WITH CHECK (true);

-- Analysis Results
DROP POLICY IF EXISTS "Allow all analysis_results operations" ON analysis_results;
CREATE POLICY "Allow all analysis_results operations" 
  ON analysis_results FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- PART 3: VERIFY RLS STATUS
-- ============================================
-- Run this query to verify all tables have RLS enabled:
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  015_user_roles.sql                                                   ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- Schema V14: User Roles and Permissions
-- Add role-based access control for analysis mode management

-- Create user role enum type
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'mode_manager', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add role column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'user';

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Set first user as admin (update this with actual user ID)
-- UPDATE users SET role = 'admin' WHERE id = 'YOUR_FIRST_ADMIN_USER_ID';

-- Comment: To set your first admin, run:
-- UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
-- or
-- UPDATE users SET role = 'admin' WHERE student_id = 'YOUR_STUDENT_ID';


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  016_project_ownership.sql                                            ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- Schema V15: Project Ownership
-- Enable project ownership for mode managers

-- Add foreign key constraint for owner_id (column already exists)
ALTER TABLE projects 
DROP CONSTRAINT IF EXISTS fk_projects_owner;

ALTER TABLE projects 
ADD CONSTRAINT fk_projects_owner 
FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;

-- Create index for owner-based queries
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);

-- Add is_public column for sharing projects
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;

-- Create index for public projects
CREATE INDEX IF NOT EXISTS idx_projects_public ON projects(is_public) WHERE is_public = true;

-- Comment: Existing projects with NULL owner_id will be managed by admins


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  017_hmw_votes_run_id.sql                                             ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

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


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  018_step_attachments.sql                                             ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- Schema V17: Analysis Step Attachments
-- Purpose: Allow uploading reference files (images, PDFs, etc.) to analysis steps
-- Use case: Upload example files for AI to reference during analysis

-- 1. Step Attachments Table
CREATE TABLE IF NOT EXISTS analysis_step_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id uuid REFERENCES analysis_flow_steps(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text, -- 'image', 'pdf', 'document', 'reference'
  storage_path text NOT NULL, -- Supabase Storage path
  mime_type text,
  file_size integer,
  description text, -- Optional description of the file's purpose
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_step_attachments_step_id 
  ON analysis_step_attachments(step_id);

-- 3. Enable Row Level Security
ALTER TABLE analysis_step_attachments ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy - Allow all operations for authenticated users
CREATE POLICY "Allow all step_attachments operations" 
  ON analysis_step_attachments 
  FOR ALL 
  USING (true);

-- 5. Comment for documentation
COMMENT ON TABLE analysis_step_attachments IS 
  'Stores reference files attached to analysis steps for AI to read during analysis';


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  019_daily_quota.sql                                                  ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- Add daily analysis quota column to users table
-- Default: 3 analyses per day per user
-- Admins can override per user

ALTER TABLE users
ADD COLUMN IF NOT EXISTS daily_analysis_quota integer DEFAULT 3;

-- Index for fast daily usage count queries
CREATE INDEX IF NOT EXISTS idx_analysis_runs_initiator_created
ON analysis_runs(initiator_id, created_at);

COMMENT ON COLUMN users.daily_analysis_quota IS 'Maximum number of analysis runs a user can initiate per day. NULL means unlimited (admin override).';


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  020_role_permissions_part1.sql                                       ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- Schema V19 - Part 1: Add new role enum values + permissions column
-- ⚠️ 請先執行此段，commit 後再執行 Part 2

-- 1. Add new role enum values
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'system_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'platform_manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'backend_user';

-- 2. Add permissions JSON column
ALTER TABLE users
ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '{}';

COMMENT ON COLUMN users.permissions IS 'Per-feature access control for backend_user. Keys: manage_modes, manage_roles, view_results, manage_users';

