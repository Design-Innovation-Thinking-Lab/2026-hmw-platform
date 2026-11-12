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
