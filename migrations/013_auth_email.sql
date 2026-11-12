-- =============================================
-- Schema V12: Add email and verification_password columns
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Add email column to users table (for non-student login)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email text UNIQUE;

-- 2. Add verification_password column if not exists
-- (This column may already exist from schema_v5, but we ensure it's there)
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_password text;

-- 3. Create index for email lookup
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 4. Create index for student_id lookup (if not exists)
CREATE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id);

-- =============================================
-- 現有使用者資料遷移
-- =============================================

-- 1. 為現有學生用戶設定驗證密碼（使用學號作為預設密碼）
UPDATE users 
SET verification_password = student_id 
WHERE occupation = 'student' AND verification_password IS NULL AND student_id IS NOT NULL;

-- 2. （原環境的一次性資料修正，已移除）
--    原本會把沒有 email 的非學生用戶統一填成原維護者的信箱。
--    新環境沒有舊資料，不需要執行。若日後有需要，自行填入信箱後再跑：
-- UPDATE users SET email = '<admin-email>' WHERE occupation != 'student' AND email IS NULL;

-- =============================================
-- 注意事項
-- =============================================
-- 
-- 1. 學生預設密碼 = 學號，建議提醒使用者登入後修改密碼
-- 3. 如有重複 email 錯誤，需先手動處理再執行
-- =============================================

