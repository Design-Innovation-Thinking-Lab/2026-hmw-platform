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
