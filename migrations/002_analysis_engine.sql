-- 002_analysis_engine.sql
-- 功能：分析引擎核心資料表（AI 角色、分析步驟、分析結果）+ 補齊後續版本遺漏的欄位
-- 影響資料表：analysis_roles（新）、analysis_flow_steps（新）、analysis_results（新）、
--            projects / analysis_runs / files / transcripts（欄位新增）
-- 回滾方式：DROP TABLE analysis_results, analysis_flow_steps, analysis_roles CASCADE;
--
-- 背景：原本的 schema_v2.sql 在專案第一個 commit 時被覆蓋成單行 ALTER TABLE，
--       這三張表的 CREATE TABLE 語句從此遺失，但程式碼一直在用。
--       本檔案依照正式環境 Supabase 的實際結構重建，欄位名稱與型別完全對應。
--       所有語句皆為 IF NOT EXISTS，在既有環境重跑不會有副作用。

-- ═══ 1. analysis_roles — AI 分析角色（system prompt）═══════════════════

CREATE TABLE IF NOT EXISTS analysis_roles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid REFERENCES projects(id) ON DELETE CASCADE,
  name          text NOT NULL,
  description   text,
  system_prompt text NOT NULL,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_roles_project ON analysis_roles(project_id);

-- ═══ 2. analysis_flow_steps — 分析流程步驟（prompt 模板）═══════════════

CREATE TABLE IF NOT EXISTS analysis_flow_steps (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid REFERENCES projects(id) ON DELETE CASCADE,
  step_index          integer NOT NULL,
  title               text NOT NULL,
  prompt_template     text NOT NULL,        -- Nunjucks 模板，可用變數見 docs/prompt-variables-guide.md
  analysis_scope      text NOT NULL,        -- 'individual'（逐檔分析）| 'collective'（彙整全部檔案）
  output_schema       jsonb,
  role_id             uuid REFERENCES analysis_roles(id) ON DELETE SET NULL,
  is_active           boolean DEFAULT true,
  prompt_image_url    text,
  input_step_indices  integer[],            -- 這一步可讀取前面哪幾步的輸出
  evaluation_criteria text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_flow_steps_project ON analysis_flow_steps(project_id, step_index);

-- ═══ 3. analysis_results — 每個步驟的 AI 輸出 ═══════════════════════════

CREATE TABLE IF NOT EXISTS analysis_results (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid REFERENCES projects(id) ON DELETE CASCADE,
  analysis_run_id   uuid REFERENCES analysis_runs(id) ON DELETE CASCADE,
  step_id           uuid REFERENCES analysis_flow_steps(id) ON DELETE SET NULL,
  file_id           uuid REFERENCES files(id) ON DELETE SET NULL,
  result_json       jsonb NOT NULL,
  status            text DEFAULT 'success',
  prompt_tokens     integer,
  completion_tokens integer,
  total_tokens      integer,
  execution_time_ms integer,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_results_run  ON analysis_results(analysis_run_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_step ON analysis_results(step_id);

-- ═══ 4. 補齊正式環境有、但先前 migration 未涵蓋的欄位 ═══════════════════
-- 這些欄位在正式環境都存在。其中少數是尚未發布的功能在用（已標註），
-- 一併建立可讓你的環境與正式環境結構一致，將來拉新功能不必再補。

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS status     text DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS skill_meta jsonb;          -- 尚未發布的功能使用

ALTER TABLE analysis_runs
  -- 以下三欄支援「從某一步重新分析」，為尚未發布的功能
  ADD COLUMN IF NOT EXISTS parent_run_id   uuid REFERENCES analysis_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS run_version     integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rerun_from_step integer;

ALTER TABLE files
  ADD COLUMN IF NOT EXISTS speaker_name   text,
  -- rooms / participants 是舊架構的表（001 建立，現行程式碼已不使用），
  -- 這兩個 FK 僅為與正式環境結構一致而保留
  ADD COLUMN IF NOT EXISTS room_id        uuid REFERENCES rooms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS participant_id uuid REFERENCES participants(id) ON DELETE SET NULL;

ALTER TABLE transcripts
  ADD COLUMN IF NOT EXISTS sequence integer;
