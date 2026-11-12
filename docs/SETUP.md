# 從零架設與接手指南

> 目標：**不需要原維護者的任何帳號**，就能架起一套完整可用的環境並繼續開發。

## 一、你需要自己申請的服務

repo 裡**沒有任何金鑰**（`.env.local` 在 `.gitignore`），所以下面三個服務要用你自己的帳號。

| 服務 | 用途 | 方案建議 | 要取得的值 |
|---|---|---|---|
| **Supabase** | Postgres + 檔案 Storage | Free 可開發；長期使用建議 Pro（Free 專案閒置一週會暫停） | Project URL、anon key、service_role key |
| **Anthropic（Claude API）** | 所有 LLM 呼叫 | console.anthropic.com 申請，無審核流程，直接買額度即可用 | API key |
| **Heroku**（或其他平台） | 跑 web + worker | worker 需常駐，不能用會休眠的方案；個人測試用途可以先不部署，本機跑 `npm run dev` + `npm run worker` 即可 | — |

變數對應關係見 [`.env.local.example`](../.env.local.example)。

> **為什麼是 Claude 不是 Azure OpenAI？** 原本預設走 Azure，但 Azure OpenAI 的存取權限申請對
> Azure for Students 這類學生方案常卡在配額審核（見 `docs/claude-api-setup-log.md`），改用
> Anthropic API 可以直接買額度、不用等審核。所有 LLM 呼叫集中在 `lib/llm/claude.js` 的
> `generateContent()`，`lib/analysis/engine.js` 只 import 這一個函式——`lib/llm/azureOpenAI.js`
> 還留著（切回 Azure，或換成 OpenAI / Gemini，只要改這一行 import、實作同樣簽名的函式即可）。

## 二、架設 Checklist

```
□ 1. npm install          （Node ≥ 22.9）
□ 2. Supabase 建立專案
□ 3. Supabase SQL Editor：跑 migrations/bundle/01_run_first.sql
□ 4. 確認成功後，再跑 migrations/bundle/02_run_second.sql
        ⚠️ 一定要分兩次、照順序，原因見 migrations/README.md
□ 5. Supabase Storage：建立 bucket「uploads」，設為 Public
□ 6. Anthropic：console.anthropic.com 申請 API key（建議先買 US$20 額度）
□ 7. cp .env.local.example .env.local，填入 2、5、6 的值
□ 8. npm run dev（終端機 A）+ npm run worker（終端機 B）
□ 9. 開 http://localhost:3000/register 註冊第一個帳號
□ 10. Supabase SQL Editor：用 migrations/templates/set_first_admin.sql 設成 system_admin
□ 11. 登入 http://localhost:3000/admin，確認看得到三個預設分析模式
         （領航員 / 教練 / 建築師）
□ 12. /admin/steps：有 4 個步驟原本帶範例圖，需要時自行重新上傳
□ 13. 建一個研究室 → 上傳一份逐字稿 → 跑一次分析，確認 worker 有反應、結果有出來
□ 14. 部署：建 app、設環境變數、push、把 web 與 worker 都 scale 到 1
□ 15. 在部署環境重複 9–13
```

## 三、卡住的時候怎麼查

| 症狀 | 可能原因 |
|---|---|
| 分析一直卡在 `pending` | worker 沒在跑，或 `ANTHROPIC_API_KEY` 錯。看 worker 的 log |
| 分析失敗，前端只顯示「連線逾時中斷」 | 這是 `engine.js` 包過的泛用訊息，真正的錯誤在 worker log 裡，往上找 `Claude (Anthropic) Error:` 那一段 |
| 後台看不到任何分析模式 | `bundle/02_run_second.sql` 沒執行（或只跑了第 1 份） |
| 上傳檔案失敗 | bucket 名稱跟 `NEXT_PUBLIC_SUPABASE_BUCKET` 不一致，或沒設成 Public |
| 進不了 `/admin` | 帳號的 `role` 不是 `system_admin`，用 templates 那支 SQL 設定 |
| `npm run build` 報 `supabaseUrl is required` | build 階段就需要環境變數，先準備好 `.env.local` |
| 跑第 2 份 SQL 報 enum 相關錯誤 | 第 1 份沒先 commit，兩份要分開按 Run |

## 四、平台運作知識（看程式碼不容易看出來的）

- **三種預設分析模式**對應三種教學路徑：領航員 8 步、教練 7 步、建築師 4 步。
  三者的框架與 prompt 差異見 [analysis-modes-comparison.md](analysis-modes-comparison.md)；
  領航員 8 步的逐步設計意圖見 [analysis-steps-guide.md](analysis-steps-guide.md)；
  整個系統怎麼把逐字稿變成 HMW 的執行邏輯見 [generation-logic.md](generation-logic.md)。
- **prompt 在資料庫**，不在程式碼。改 prompt 從 `/admin/steps` 改，不用重新部署。
- **`analysis_scope`**：`individual` = 每份逐字稿各跑一次；`collective` = 所有逐字稿一起餵進 prompt。
- **`input_step_indices`** 決定某一步能讀到前面哪幾步的輸出，是串起整條分析鏈的關鍵。
- **角色階層**：`system_admin` > `platform_manager` > `backend_user`（看 `permissions` JSON 細分）> `user`。
  `admin` / `mode_manager` 是舊值，021 已遷移掉。
- **Storage**：逐字稿原檔與步驟範例圖都放同一個 bucket；worker 解析時用 service_role key 下載。
- **每日分析額度**：`users.daily_analysis_quota` 預設 3，以 Asia/Taipei 時區計算當日用量。

## 五、已知問題與技術債

依嚴重程度排序。**公開上線前務必先處理前三項。**

| # | 問題 | 位置 | 說明 |
|---|---|---|---|
| 1 | **密碼明文儲存** | `users.verification_password`、`pages/api/users/login.js` | 沒有 hash，直接用 `.eq()` 比對。學生帳號預設密碼 = 學號 |
| 2 | **API 授權靠前端自報身分** | `pages/api/*`、`localStorage.userRole` | 沒有 session / JWT，request 帶什麼 userId 就當成是誰。課堂內網勉強可用，對外必須改 |
| 3 | **debug API 無任何保護** | `pages/api/debug/fix-run.js` | 可直接 reset 任何研究室的分析狀態。研究室頁面有在呼叫它，不能直接刪，建議加管理員檢查 |
| 4 | RLS policy 形同虛設 | `migrations/014` | 全部 `USING (true)`，且 app 走 service_role 本來就繞過 RLS。目前無害，但不要誤以為資料庫層有防護 |
| 5 | 聯絡表單不會寄信 | `pages/api/contact.js` | Resend 的程式碼被註解掉，目前只 `console.log` |
| 6 | 舊架構遺留表未清理 | 資料庫 | 正式環境有 7 張舊表帶著歷史資料，現行程式碼完全不讀寫。詳見 migrations/README.md |
| 7 | 010 / 011 與 003 內容重複 | `migrations/` | 歷史原因，全部 `IF NOT EXISTS`，無害 |
| 8 | 沒有自動化測試 | — | 建議從 `lib/analysis/engine.js` 的 prompt 組裝邏輯開始補 |

## 六、建議的後續路線

1. 先修掉上面 #1–#3，再考慮對外開放
2. 把 LLM 呼叫抽成可切換供應商
3. 加 GitHub Actions 跑 `npm run build`（目前沒有 CI）
4. 考慮接 Supabase CLI（`supabase db push`）取代手動貼 SQL
