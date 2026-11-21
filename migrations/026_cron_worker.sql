-- 026_cron_worker.sql
-- 功能：常駐 worker 改成 Vercel Cron 每分鐘呼叫 /api/cron/worker，一個分析可以分好幾輪跑完
--
-- 影響資料表：analysis_runs、analysis_results
--
-- 1. analysis_runs 新增欄位
--    locked_until      這一輪 cron 佔用這個分析到什麼時候（租約）。
--                      正常暫停時清成 NULL，下一輪馬上接手；
--                      如果那一輪被 Vercel 中途砍掉（超過時間上限），租約過期後下一輪也會接手。
--    crash_count       租約過期才被接手的次數（代表那一輪沒有正常結束）。
--                      超過上限就標成 failed，避免一直重試同一個跑不完的步驟、一直花錢。
--    tick_count        總共跑了幾輪。
--    longest_call_ms   這個分析裡「最長的一步」：單次 LLM 呼叫（含重試）花了多久，毫秒。
--    longest_call_label 那一步是哪個步驟／哪份逐字稿。
--    cron 會用最近分析的 longest_call_ms 決定剩下多少時間就不再開始新的一步。
--
-- 2. analysis_results.room_transcript_id
--    研究室分析的「逐份」步驟原本 file_id 一律存 NULL，接續時分不出哪份逐字稿已經做完，
--    只好整步重跑（重複花錢）。這欄記錄是哪份逐字稿的結果。
--
-- 3. claim_analysis_runs(lease_seconds, max_runs)
--    原子地搶下可以執行的分析（FOR UPDATE SKIP LOCKED），多個 cron 同時執行也不會搶到同一個。
--    只有 service_role 能呼叫。
--
-- 回滾方式：
--   DROP FUNCTION IF EXISTS public.claim_analysis_runs(integer, integer);
--   ALTER TABLE analysis_results DROP COLUMN IF EXISTS room_transcript_id;
--   ALTER TABLE analysis_runs DROP COLUMN IF EXISTS locked_until, DROP COLUMN IF EXISTS crash_count,
--     DROP COLUMN IF EXISTS tick_count, DROP COLUMN IF EXISTS longest_call_ms, DROP COLUMN IF EXISTS longest_call_label;

ALTER TABLE public.analysis_runs
  ADD COLUMN IF NOT EXISTS locked_until       timestamptz,
  ADD COLUMN IF NOT EXISTS crash_count        integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tick_count         integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_call_ms    integer,
  ADD COLUMN IF NOT EXISTS longest_call_label text;

CREATE INDEX IF NOT EXISTS idx_analysis_runs_status_created
  ON public.analysis_runs(status, created_at);

ALTER TABLE public.analysis_results
  ADD COLUMN IF NOT EXISTS room_transcript_id uuid REFERENCES public.room_transcripts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_analysis_results_run_step
  ON public.analysis_results(analysis_run_id, step_id);

CREATE OR REPLACE FUNCTION public.claim_analysis_runs(lease_seconds integer, max_runs integer)
RETURNS SETOF public.analysis_runs
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT r.id
    FROM public.analysis_runs r
    WHERE r.status = 'pending'
       OR (r.status = 'processing' AND (r.locked_until IS NULL OR r.locked_until < now()))
    ORDER BY r.created_at
    LIMIT GREATEST(max_runs, 0)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.analysis_runs r
  SET status       = 'processing',
      -- 租約還在（locked_until 有值）卻過期了 → 上一輪沒有正常結束
      crash_count  = r.crash_count + CASE WHEN r.status = 'processing' AND r.locked_until IS NOT NULL THEN 1 ELSE 0 END,
      tick_count   = r.tick_count + 1,
      locked_until = now() + make_interval(secs => lease_seconds),
      started_at   = COALESCE(r.started_at, now())
  FROM candidates c
  WHERE r.id = c.id
  RETURNING r.*;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_analysis_runs(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_analysis_runs(integer, integer) TO service_role;
