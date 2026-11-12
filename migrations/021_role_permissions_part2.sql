-- Schema V19 - Part 2: Migrate existing roles to new values
-- ⚠️ 請在 Part 1 執行並 commit 之後再執行此段

-- admin → system_admin
UPDATE users SET role = 'system_admin' WHERE role = 'admin';

-- mode_manager → backend_user (with full backend permissions)
UPDATE users SET
  role = 'backend_user',
  permissions = '{"manage_modes": true, "manage_roles": true, "view_results": true, "manage_users": false}'
WHERE role = 'mode_manager';
