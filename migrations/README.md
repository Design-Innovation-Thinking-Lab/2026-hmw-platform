# 資料庫建置

## 最快的方式：跑兩份打包好的 SQL

`bundle/` 裡是把 `001`–`024` 合併好的兩份檔案，內容與逐支檔案完全相同。
到 **Supabase Dashboard → SQL Editor**，整檔複製貼上後 Run：

1. **`bundle/01_run_first.sql`** — 建立所有資料表結構（001–020）
2. **`bundle/02_run_second.sql`** — 角色遷移 + 預設分析模式的 prompt（021–024）

**必須分兩次執行，順序不能顛倒。** 原因：`020` 用 `ALTER TYPE ... ADD VALUE` 新增
enum 值，Postgres 規定新增的值要等該交易 commit 後才能使用，而 `021` 會用到它們。
SQL Editor 每按一次 Run 就是一個交易，分兩次跑剛好滿足這個限制。

想逐支檢視或逐支執行也可以，就照 `001` → `024` 的順序，**每一支都要跑，沒有例外**。

## 跑完之後還要做三件事

1. **Supabase Storage** → 建立一個 **Public** bucket，名稱要跟 `NEXT_PUBLIC_SUPABASE_BUCKET`
   一致（預設 `uploads`）。沒有這個 bucket 無法上傳逐字稿。
2. 到網站 `/register` 註冊第一個帳號。
3. 用 `templates/set_first_admin.sql` 把那個帳號設成 `system_admin`，才能進 `/admin`。

## 各檔案內容

| 檔案 | 內容 |
|---|---|
| `001_initial.sql` | projects / files / transcripts / analysis_runs 等基礎表 |
| `002_analysis_engine.sql` | **analysis_roles / analysis_flow_steps / analysis_results**（依正式環境結構重建，見檔頭說明） |
| `003_usage.sql` | analysis_results 的 token 統計欄位 |
| `004_users_rooms.sql` | users / research_rooms / room_members |
| `005_login.sql` | users.student_id / verification_password |
| `006_room_transcripts.sql` | room_transcripts |
| `007_room_analysis.sql` | analysis_runs.room_id、research_rooms.analysis_status |
| `008_default_project.sql` | projects.is_default |
| `009_hmw_votes.sql` | hmw_votes |
| `010_usage_summary.sql` | analysis_runs.usage_summary（與 003 部分重疊，無害） |
| `011_analysis_results_tokens.sql` | token 欄位（與 003 重疊，無害） |
| `012_project_created_by_admin.sql` | projects.created_by / users.is_admin |
| `013_auth_email.sql` | users.email |
| `014_enable_rls_all_tables.sql` | 全表開 RLS（app 走 service_role，policy 實際不生效） |
| `015_user_roles.sql` | `user_role` enum + users.role |
| `016_project_ownership.sql` | projects.owner_id / is_public |
| `017_hmw_votes_run_id.sql` | hmw_votes.analysis_run_id |
| `018_step_attachments.sql` | analysis_step_attachments |
| `019_daily_quota.sql` | users.daily_analysis_quota |
| `020_role_permissions_part1.sql` | enum 新增 system_admin 等 + users.permissions |
| `021_role_permissions_part2.sql` | 舊角色遷移到新角色 |
| `022_password_reset.sql` | users.must_change_password |
| `023_hmw_votes_vote_type.sql` | hmw_votes.vote_type |
| `024_seed_default_analysis_modes.sql` | **三種預設分析模式的 prompt** |

`024` 特別說明：**分析用的 prompt 存在資料庫、不在程式碼裡**
（`analysis_roles.system_prompt`、`analysis_flow_steps.prompt_template`，從後台 `/admin/steps` 編輯）。
所以結構建完還不夠，沒跑 `024` 的話後台看不到任何分析模式、一個分析都跑不出來。

## 這裡建出 19 張表，正式環境有 28 張

多出來的 9 張分兩類，**都不需要建立**：

- **舊架構遺留**：`analysis_logs`、`analysis_prompts`、`hmw_evidence`、`skill_knowledge_items`、
  `step_evaluations` — 資料最後更新停在 2026-01-06，現行程式碼完全沒有讀寫，
  後來改用 `analysis_runs` + `analysis_results`。
- **尚未發布的功能**：`hmw_evaluation_runs`、`hmw_evaluation_scores`、
  `hmw_evaluation_feedback`、`hmw_final_decisions` — 正式環境已建表但 0 筆資料，
  對應程式碼還沒發布，等功能上線時會一併提供 migration。

> `001_initial.sql` 另外會建出 `rooms`、`participants`、`votes`、`hmw_candidates`、
> `hmw_sources`、`prompt_steps`，這些也是舊架構的表，現行程式碼不使用，
> 但為保持 001 原樣未做刪減，留著不影響任何功能。

## 新增 migration 的規則

- 檔名 `NNN_描述.sql`，NNN 接續現有最後一號，不跳號；加完記得重新產生 `bundle/`
- 一律用 `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`，重跑不會壞
- 檔頭寫清楚：功能、影響資料表、回滾方式
- **只做加法**（新增欄位 / 表 / 索引）。要改型別或刪欄位，先確認舊版程式碼不再依賴
- `ALTER TYPE ... ADD VALUE` 必須單獨一支，不能和使用新值的 `UPDATE` 放在同一支（見 020 / 021）

## 驗證方式

這 24 支（以及 `bundle/` 的兩份）已用 PGlite（純 Node 的 Postgres，不需要 Docker 或 psql）
從零跑過，並與正式環境逐欄比對過程式碼用到的 13 張表。改動後可以照同樣方式驗證：

```bash
mkdir -p /tmp/mig-test && cd /tmp/mig-test && npm init -y && npm i @electric-sql/pglite
```

```js
// /tmp/mig-test/run.mjs
import { PGlite } from '@electric-sql/pglite'
import fs from 'fs'; import path from 'path'
const dir = process.argv[2], db = new PGlite()
for (const f of fs.readdirSync(dir).filter(f => /^\d{3}_.*\.sql$/.test(f)).sort()) {
  // Supabase 預裝 pgcrypto，PGlite 沒有這個 extension 但內建 gen_random_uuid()
  const sql = fs.readFileSync(path.join(dir, f), 'utf8')
    .replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/g, '')
  try { await db.exec(sql); console.log('ok  ', f) }
  catch (e) { console.log('FAIL', f, e.message); process.exit(1) }
}
console.log('全部通過')
```

```bash
node /tmp/mig-test/run.mjs /path/to/repo/migrations
```
