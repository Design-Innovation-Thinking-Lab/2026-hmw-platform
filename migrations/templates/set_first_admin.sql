-- templates/set_first_admin.sql
-- 用途：把第一位使用者設為系統管理員，才能進入後台 /admin。
-- 步驟：
--   1. 先在網站 /register 註冊一個帳號
--   2. 把下面的 <student_id> / <email> 換成你註冊時填的值
--   3. 在 Supabase SQL Editor 執行
--
-- 角色說明（見 015 / 020）：
--   system_admin      全部後台功能
--   platform_manager  平台管理
--   backend_user      依 permissions JSON 細分（manage_modes / manage_roles / view_results / manage_users）
--   user              一般使用者（註冊預設值）

-- Step 1：確認帳號存在
SELECT id, name, student_id, email, role, created_at
FROM users
WHERE student_id ILIKE '<student_id>' OR email ILIKE '<email>';

-- Step 2：設為系統管理員
UPDATE users
SET role = 'system_admin',
    is_admin = true,
    permissions = '{"manage_modes": true, "manage_roles": true, "view_results": true, "manage_users": true}'
WHERE student_id ILIKE '<student_id>' OR email ILIKE '<email>';

-- Step 3：驗證
SELECT id, name, student_id, email, role, is_admin, permissions
FROM users
WHERE role = 'system_admin';
