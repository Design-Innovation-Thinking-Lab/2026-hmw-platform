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
