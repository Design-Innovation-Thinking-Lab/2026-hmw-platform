# AI HMW Platform

## 研究室專案資訊（DITL）

| 項目 | 內容 |
|---|---|
| 用途 | 上傳訪談逐字稿，AI 依多步驟流程分析，產出 HMW 問題句，團隊在研究室裡投票 |
| 負責人 | DITL Jenny（Email、電話只寫在研究室的私有登記表） |
| 網站 | 〈Vercel 網址，部署後填入〉 |
| 用到的服務 | GitHub（本 repo）、Vercel（網站與 API、Cron）、Supabase（資料庫、Storage 私人 bucket `uploads`）、Anthropic API（研究室的 key） |
| 聯絡 | drhhtang@gapps.ntust.edu.tw |
| 狀態 | 搬進研究室中（2026-11）；正式上線前要先完成下面的安全修正 |

### 研究室部署狀態（2026-11-12）

這個專案從學生交的 zip 建立，原本部署在 Heroku。搬到研究室的 Vercel + Supabase 之前，**一定要先修好**以下問題（詳見 [docs/SETUP.md](docs/SETUP.md) 第五節），修好並經過審核之前不放真資料、不公開網址：

- [ ] 密碼改成雜湊，或改用 Supabase Auth（目前明文儲存）
- [ ] API 改在伺服器端確認身分（目前相信前端送來的 userId）
- [ ] `pages/api/debug/fix-run.js` 加上管理員檢查
- [ ] Storage bucket `uploads` 改成私人，用 signed URL 讀取
- [ ] 常駐 worker 改成 Vercel Cron 定時呼叫受保護的 API，每次跑一輪（可借用 `WORKER_MODE=job`）
- [ ] 超過 4.5 MB 的上傳改用 signed upload URL 直接傳到 Storage

### 接手（學生）

1. 在 GitHub 的 **Settings → Emails** 開啟「Keep my email addresses private」，本機 Git Email 設成 GitHub 給你的 noreply 信箱。這個 repo 是公開的。
2. `git clone https://github.com/Design-Innovation-Thinking-Lab/2026-hmw-platform.git`，之後都在這個資料夾開發，不要再改交 zip 之前的舊資料夾。
3. 每項修改開一個分支、發 Pull Request；`main` 要經過 PR 才能合併。
4. 環境變數和金鑰由老師在 Vercel 設定；本機開發需要的值請找老師或助理，用老師指定的方式取得，不要貼到聊天、網頁或 AI 對話裡。
5. 部署失敗請找老師或助理（學生的 Vercel Viewer 權限看不到 log）。

以下是原專案的說明。


人機協作的 UX 質性研究平台：上傳訪談逐字稿，AI 依照可設定的多步驟分析流程
（開放性編碼 → 主軸編碼 → 選擇性編碼 → JTBD → HMW）產出 HMW 問題句，團隊在研究室（room）裡投票。

> **第一次接手本專案，請先讀 [docs/SETUP.md](docs/SETUP.md)。**

## 架構

```
                      ┌──────────────────────────────┐
  瀏覽器 ───────────▶ │  web   (Next.js 14, pages/)   │──┐
                      └──────────────────────────────┘  │
                                                        ▼
                      ┌──────────────────────────────┐   Supabase
  背景輪詢 ◀───────── │  worker (server/worker.js)    │◀─▶ Postgres + Storage
  解析檔案、跑分析    └──────────────────────────────┘
                                 │
                                 ▼
                           Azure OpenAI
```

兩個 process 都要跑，平台才完整：

| Process | 指令 | 做什麼 |
|---|---|---|
| **web** | `npm run dev` / `npm start` | 前端頁面 + `/api/*`。所有資料庫存取走 `SUPABASE_SERVICE_ROLE_KEY` |
| **worker** | `npm run worker` | 每 5 秒輪詢：`files.status='uploaded'` → 解析成段落；`analysis_runs.status='pending'` → 依 `analysis_flow_steps` 逐步呼叫 Azure OpenAI |

**分析用的 prompt 存在資料庫，不在程式碼裡**（`analysis_roles.system_prompt`、
`analysis_flow_steps.prompt_template`），從後台 `/admin/steps` 編輯，改完不需要重新部署。
模板語法是 Nunjucks，可用變數見 [docs/prompt-variables-guide.md](docs/prompt-variables-guide.md)。

## 本機開發

需求：Node **≥ 22.9**（`npm run worker` 用到 `--env-file-if-exists`）。

```bash
npm install
cp .env.local.example .env.local   # 填入 Supabase 與 Azure OpenAI 的值
```

資料庫：在 Supabase 建一個新專案，依 [migrations/README.md](migrations/README.md)
跑 `migrations/bundle/` 裡的兩份 SQL，再建立 Public bucket `uploads`。
完整流程見 [docs/SETUP.md](docs/SETUP.md)。

啟動（兩個終端機，或用 `./start-dev.sh` 一次起兩個）：

```bash
npm run dev
```

```bash
npm run worker
```

- http://localhost:3000 — 首頁 / 登入 / 註冊
- http://localhost:3000/admin — 後台（需 `system_admin` 角色，見 `migrations/templates/set_first_admin.sql`）

> `npm run build` 在 build 階段就需要 `NEXT_PUBLIC_SUPABASE_URL`
> （`lib/supabaseClient.js` 在模組載入時就建立 client），所以本機 build 前要先準備好 `.env.local`。

## 部署

> 研究室版本改用 Vercel + Supabase（見上方「研究室部署狀態」）。以下是原本的 Heroku 做法，搬遷完成後會改寫。

正式環境跑在 **Heroku**，`Procfile` 定義 `web` 與 `worker` 兩個 dyno。

```bash
heroku create <app-name>
git push heroku main
heroku ps:scale web=1 worker=1
```

環境變數填在 Dashboard → Settings → Config Vars（內容同 `.env.local`）。

`worker` 是常駐輪詢，**不適用會休眠的 dyno 方案**，否則分析會卡在 pending。

## 目錄

```
pages/            Next.js 頁面與 API routes
  admin/          後台：分析步驟、AI 角色、使用者、結果
  api/            REST endpoints（analysis/、rooms/、users/…）
  room/[id].js    研究室主畫面
lib/analysis/     分析引擎（engine.js）、附件處理、smart inject
lib/llm/          Azure OpenAI 封裝 + rate limiter
server/           worker.js（輪詢主程式）、parseWorker.js（txt/docx/pdf 解析）
migrations/       資料庫 SQL；bundle/ 是打包好可直接執行的兩份，README 有說明
docs/             架設指南、分析步驟設計、prompt 變數說明
```

## 相關文件

- [docs/SETUP.md](docs/SETUP.md) — 從零架設、外部服務、已知問題
- [docs/analysis-steps-guide.md](docs/analysis-steps-guide.md) — 八步驟分析流程各步的設計意圖
- [docs/prompt-variables-guide.md](docs/prompt-variables-guide.md) — prompt 模板可用變數
