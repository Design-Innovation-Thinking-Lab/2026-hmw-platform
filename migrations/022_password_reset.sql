-- Schema V20: Password reset support
-- Adds flag to force password change on next login

ALTER TABLE users
ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT false;

COMMENT ON COLUMN users.must_change_password IS 'When true, user must change password on next login (set by admin password reset)';
