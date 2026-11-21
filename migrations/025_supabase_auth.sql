-- 025_supabase_auth.sql
-- 功能：登入改用 Supabase Auth（Email + 密碼、Google），並關閉讓 anon key 可讀寫全部資料的 policy
--
-- 影響資料表：users、以及 004 / 006 / 009 / 014 / 018 建立過 "Allow all ..." policy 的所有表
--
-- 1. users 與 auth.users 對應：
--    - 新使用者在 Supabase Auth 註冊（Email 或 Google）時，trigger 自動在 public.users
--      建一筆同 id 的資料（role 一律是預設的 'user'，角色不從 user_metadata 讀，
--      因為 user_metadata 使用者自己就能改）。
--    - occupation 改成可為 NULL：剛註冊、還沒填個人資料的人 occupation 是 NULL，
--      前端會導去 /profile-setup 補填。
--    - 移除 verification_password（明文密碼）與 must_change_password：密碼改由
--      Supabase Auth 雜湊保存，這兩欄已經沒有程式碼使用。
--    - student_id 不再是登入帳號，只是個人資料欄位，取消 unique。
--    - public.users 不加指向 auth.users 的外鍵：舊環境移轉過來的結果會掛在
--      不能登入的匿名使用者底下，這些人沒有 auth.users 帳號。
--
-- 2. RLS：
--    之前的 policy 全部是 USING (true)，而 anon key 是公開的（前端看得到），
--    等於任何人都能用 REST API 直接讀寫所有表（包括 users）。
--    這裡把那些 policy 全部刪掉、RLS 保持開啟 → anon / authenticated 角色讀寫不到任何資料，
--    只有伺服器端的 service_role（會略過 RLS）能存取。前端一律透過 pages/api/*。
--    只刪本專案 migration 建過的 policy（逐一列名），不碰同一個資料庫裡其他專案的東西。
--
-- 執行前提：舊環境的「使用者帳號」不移轉（只移轉結果）。
--           若 users 表裡已經有舊資料，verification_password 會被刪掉，這是預期的。
--
-- 回滾方式（不建議，會回到明文密碼）：
--   DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
--   DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
--   DROP FUNCTION IF EXISTS public.handle_new_auth_user();
--   DROP FUNCTION IF EXISTS public.handle_auth_user_email_update();
--   ALTER TABLE users ADD COLUMN verification_password text, ADD COLUMN must_change_password boolean DEFAULT false;
--   （policy 請勿回復）

-- ─── 1. users 欄位調整 ───────────────────────────────────────────────────────

ALTER TABLE public.users ALTER COLUMN occupation DROP NOT NULL;

ALTER TABLE public.users DROP COLUMN IF EXISTS verification_password;
ALTER TABLE public.users DROP COLUMN IF EXISTS must_change_password;

DROP INDEX IF EXISTS public.idx_users_student_id;
CREATE INDEX IF NOT EXISTS idx_users_student_id ON public.users(student_id);

-- ─── 2. auth.users → public.users ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    NEW.id,
    lower(NEW.email),
    COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''),
      NULLIF(trim(NEW.raw_user_meta_data ->> 'name'), ''),
      split_part(COALESCE(NEW.email, ''), '@', 1),
      '使用者'
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

CREATE OR REPLACE FUNCTION public.handle_auth_user_email_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.users SET email = lower(NEW.email) WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.handle_auth_user_email_update();

-- 這兩個 function 只給 trigger 用，不開放給 REST API 呼叫
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_auth_user_email_update() FROM PUBLIC, anon, authenticated;

-- ─── 3. 刪除 USING (true) 的 policy，RLS 保持開啟 ─────────────────────────────

ALTER TABLE public.hmw_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all users operations"            ON public.users;
DROP POLICY IF EXISTS "Allow all rooms operations"            ON public.research_rooms;
DROP POLICY IF EXISTS "Allow all room_members operations"     ON public.room_members;
DROP POLICY IF EXISTS "Allow all room_transcripts operations" ON public.room_transcripts;
DROP POLICY IF EXISTS "Allow all hmw_votes operations"        ON public.hmw_votes;
DROP POLICY IF EXISTS "Allow all step_attachments operations" ON public.analysis_step_attachments;
DROP POLICY IF EXISTS "Allow all projects operations"         ON public.projects;
DROP POLICY IF EXISTS "Allow all files operations"            ON public.files;
DROP POLICY IF EXISTS "Allow all transcripts operations"      ON public.transcripts;
DROP POLICY IF EXISTS "Allow all prompt_steps operations"     ON public.prompt_steps;
DROP POLICY IF EXISTS "Allow all analysis_runs operations"    ON public.analysis_runs;
DROP POLICY IF EXISTS "Allow all hmw_candidates operations"   ON public.hmw_candidates;
DROP POLICY IF EXISTS "Allow all hmw_sources operations"      ON public.hmw_sources;
DROP POLICY IF EXISTS "Allow all rooms operations"            ON public.rooms;
DROP POLICY IF EXISTS "Allow all participants operations"     ON public.participants;
DROP POLICY IF EXISTS "Allow all votes operations"            ON public.votes;
DROP POLICY IF EXISTS "Allow all analysis_roles operations"   ON public.analysis_roles;
DROP POLICY IF EXISTS "Allow all analysis_flow_steps operations" ON public.analysis_flow_steps;
DROP POLICY IF EXISTS "Allow all analysis_results operations" ON public.analysis_results;
