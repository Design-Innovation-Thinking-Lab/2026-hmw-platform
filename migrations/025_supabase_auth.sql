-- =============================================
-- 025: 密碼改由 Supabase Auth 保管，移除明文密碼欄位
-- =============================================
-- 功能：
--   users.verification_password 原本存明文，登入用 .eq() 直接比對；
--   013 還把學生的預設密碼設成學號。
--   程式改成用 Supabase Auth 註冊、登入與改密碼（lib/serverAuth.js），
--   密碼只存在 Supabase Auth，users 表不再需要這個欄位，這支把它整欄刪除。
--
--   改用 Supabase Auth 之後註冊的帳號，users.id 和 Supabase Auth 的帳號 id 相同，
--   其他資料表照舊參照 users.id，不用改。
--
-- 影響資料表：users（刪除 verification_password 欄位）
--
-- 執行時機：先部署新版程式、再執行這支（新版程式完全不讀這個欄位）。
--   如果先執行這支，舊版程式的登入、註冊會壞掉。
--
-- 對既有帳號的影響：改用 Supabase Auth 之前建立的帳號沒有 Supabase Auth 帳號，
--   執行前後都無法用新版程式登入，需要重新註冊（目前資料庫只有測試用的假資料）。
--
-- 可重跑：用 DROP COLUMN IF EXISTS，欄位已經不在時不會出錯。
--
-- 回滾方式：欄位裡的明文密碼會被刪除，無法還原，這支不能回滾。
-- =============================================

ALTER TABLE users DROP COLUMN IF EXISTS verification_password;

COMMENT ON COLUMN users.id IS
  'Accounts created after 025 use the same id as auth.users.id (Supabase Auth). Passwords live only in Supabase Auth.';
