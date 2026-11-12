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
