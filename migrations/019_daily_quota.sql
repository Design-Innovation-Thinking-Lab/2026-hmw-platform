-- Add daily analysis quota column to users table
-- Default: 3 analyses per day per user
-- Admins can override per user

ALTER TABLE users
ADD COLUMN IF NOT EXISTS daily_analysis_quota integer DEFAULT 3;

-- Index for fast daily usage count queries
CREATE INDEX IF NOT EXISTS idx_analysis_runs_initiator_created
ON analysis_runs(initiator_id, created_at);

COMMENT ON COLUMN users.daily_analysis_quota IS 'Maximum number of analysis runs a user can initiate per day. NULL means unlimited (admin override).';
