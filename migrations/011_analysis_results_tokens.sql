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
