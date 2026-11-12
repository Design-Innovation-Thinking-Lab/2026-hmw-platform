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
