# CLAUDE.md — DITL 研究室專案規則（hmw-platform）

這是 DITL 研究室的專案，放在研究室的 GitHub（Public repo）、Vercel 和 Supabase。之後會交接給研究室繼續運作，請遵守以下規則。

## 架構

- Next.js 14（pages router）：`pages/` 是頁面，`pages/api/` 是 API（在 Vercel 上是伺服器端函式）。
- `lib/analysis/` 是分析引擎，`lib/llm/` 是 LLM 封裝（目前用 Anthropic API）。
- `server/worker.js` 原本是常駐的輪詢程式。Vercel 不能跑常駐程式，正在改成用 Vercel Cron 定時呼叫受保護的 API（見 README「研究室部署狀態」）。
- `migrations/` 是資料庫定義的唯一來源；`migrations/bundle/` 由逐支 migration 合併產生。

## 必須遵守

1. **不要讀、印出或 commit 任何密鑰。** `.env*`（`.env.local.example` 除外）都不要打開。需要設定時，請使用者找老師到 Vercel 的 Environment Variables 設定。
2. **`SUPABASE_SERVICE_ROLE_KEY` 和 `ANTHROPIC_API_KEY` 只能在伺服器端使用**（`pages/api/`、`lib/`、`server/`）。不能出現在 `pages/` 的前端程式、`NEXT_PUBLIC_*` 變數或 API 回應裡。
3. **每支 API 都要在伺服器端確認是誰、能做什麼。** service role 會略過 RLS；不能相信前端送來的 userId 或角色（`localStorage` 不算驗證）。會觸發 LLM 分析（花研究室的錢）的 API 一定要先登入並檢查額度。
4. **密碼不能明文儲存或比對**，要用雜湊（bcrypt／argon2），或改用 Supabase Auth。
5. **資料庫的任何變更都寫成新的 migration**（`NNN_描述.sql`，接續最後一號），並重新產生 `bundle/`。不要修改已經執行過的 migration。
6. **每張新資料表都要 `enable row level security`。**
7. **Storage bucket 一律私人**，用 signed URL 讀寫。逐字稿是研究資料。
8. **新增環境變數時，同步更新 `.env.local.example`**（只寫名稱和說明，不寫值）。
9. **README 的「研究室專案資訊」表保持最新**，交接時要靠它判斷要交接哪些設定與服務。
10. 修改後至少執行 `npm run build`（需要 `.env.local`，見 README）。

## 不要做

- 不要把個資、研究資料、訪談逐字稿、聯絡方式或真實學號放進 repo（包括 migration 的 seed 資料和範例）。這個 repo 是公開的，commit 紀錄刪不掉。
- 不要自己改用其他部署平台或個人帳號部署；部署有問題請找老師或助理。
- 不要動研究室 Supabase 裡別人專案的資料。
