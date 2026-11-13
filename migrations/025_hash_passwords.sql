-- =============================================
-- 025: 密碼改成 bcrypt 雜湊
-- =============================================
-- 功能：
--   users.verification_password 原本存明文，登入用 .eq() 直接比對。
--   程式改成只存 bcrypt 雜湊（lib/password.js），這支把既有的明文一次轉成雜湊。
--   pgcrypto 的 crypt(..., gen_salt('bf')) 產生 $2a$ 格式，與 bcryptjs 相容，
--   使用者原本的密碼轉換後仍可登入。
--
-- 影響資料表：users（verification_password、must_change_password）
--
-- 可重跑：已經是雜湊（$2a$ / $2b$ / $2y$ 開頭）的不會再轉一次。
--
-- 回滾方式：雜湊無法還原成明文，這支不能回滾。
--   如果要退回舊版程式，使用者需要由管理員重設密碼。
--   請先部署新版程式、再執行這支（或同時進行）。
-- =============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. 猜得到的預設密碼（013 設的「密碼 = 學號」、舊版重設的「0000」）
--    → 強制下次登入變更。要在轉雜湊之前做，轉完就無法判斷了。
UPDATE users
SET must_change_password = true
WHERE verification_password IS NOT NULL
  AND verification_password !~ '^\$2[aby]\$'
  AND (
        verification_password = '0000'
     OR (student_id IS NOT NULL AND upper(verification_password) = upper(student_id))
  );

-- 2. 把所有明文密碼轉成 bcrypt 雜湊（cost 10，與 lib/password.js 一致）
UPDATE users
SET verification_password = crypt(verification_password, gen_salt('bf', 10))
WHERE verification_password IS NOT NULL
  AND verification_password !~ '^\$2[aby]\$';

COMMENT ON COLUMN users.verification_password IS
  'bcrypt hash only (see lib/password.js). Never store or compare plaintext.';
