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
