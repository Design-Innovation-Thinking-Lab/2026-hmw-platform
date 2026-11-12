# 架設記錄：從 Azure OpenAI 換成 Claude API

> 時間：2026-10 下旬。記錄「為什麼換」「換了什麼」「踩了哪些坑」，給之後接手或回頭查的人看。

## 為什麼換掉 Azure OpenAI

`docs/SETUP.md` 原本預設走 Azure OpenAI。實際申請時卡在：Azure for Students 方案雖然官方頁面寫有包含 Azure OpenAI，但預設配額（quota）通常是 0，要另外送配額申請，而且審核經常卡住或被拒——這是 Azure for Students 這類學生/免費方案常見的限制，不是設定錯誤。

改用 **Anthropic API**（console.anthropic.com）：不用等審核，直接買額度、拿 API key 就能用，本機測試跟之後部署是同一組 key。

## 換了什麼

- 新增 `lib/llm/claude.js`，跟 `lib/llm/azureOpenAI.js` 一樣的 `generateContent()` 介面（同樣的參數、同樣回傳 `{ result, usage }`），方便之後想切回 Azure 或換別家只要改 `lib/analysis/engine.js` 的 import 一行。
- `lib/analysis/engine.js` 的 import 從 `../llm/azureOpenAI.js` 改成 `../llm/claude.js`。
- 裝 `@anthropic-ai/sdk`。
- `.env.local.example` 把 Azure 那組必填變數換成 `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` / `ANTHROPIC_MAX_TOKENS`；Azure 的變數保留但註解掉（程式碼沒刪，之後要切回去還能用）。

## 踩到的兩個真問題（不是設定錯，是程式邏輯本身的 bug）

### 1. `temperature` 參數被模型直接拒絕

第一次實測分析失敗，前端只顯示「分析因連線逾時中斷」——這是 `engine.js` 包過的泛用錯誤訊息，蓋住了真正的原因。查 worker log 才看到：

```
400 {"type":"invalid_request_error","message":"temperature: Extra inputs are not permitted"}
```

直接用 curl 打 API 複現、確認：`claude-sonnet-5-5` 這個模型**完全不接受 `temperature` 參數**（官方訊息是「已棄用」，不是數值範圍問題）。`claude.js` 原本跟 `azureOpenAI.js` 一樣在 request body 裡固定帶這個參數，所以每次呼叫都被 400 擋下來。

**修法**：`claude.js` 的 request body 直接拿掉 `temperature`。

### 2. `max_tokens` 調高後，SDK 強制要求用串流模式

修掉 temperature 之後，又踩到 `stop_reason: max_tokens`——回覆還沒寫完就被切斷，JSON 不完整，解析失敗。原因是一開始把 `ANTHROPIC_MAX_TOKENS` 設成 8192（抄 Azure 那邊保守的預設值），對教練模式這種需要產出完整表格的 collective 步驟來說太小。

調高到 32768 之後，又跳出新錯誤：

```
Streaming is required for operations that may take longer than 10 minutes.
```

這是 Anthropic SDK **自己的保護機制**（`Anthropic.calculateNonstreamingTimeout`）：`max_tokens` 設太高時，SDK 判斷這個請求可能跑很久，直接在送出前就拒絕非串流呼叫，要求改用串流。

**修法**：`claude.js` 的 API 呼叫從 `messages.create(...)` 改成 `messages.stream(...).finalMessage()`，拿到跟 `create()` 一樣格式的完整結果，但不會被這個保護機制擋下來。

## 順便補的一個資料庫安全漏洞

檢查 migrations 時發現：`009_hmw_votes.sql` 建立了 `hmw_votes` 表，但 `014_enable_rls_all_tables.sql`（幫其他 17 張表開 RLS 的腳本）漏列了這一張。結果是 `hmw_votes` 沒有開 RLS，又被 Supabase「自動曝光新資料表」的設定自動開放成 REST API 可讀寫——任何拿到 `anon` key 的人都能直接讀寫這張表，不用通過任何權限檢查。

這是 Jintin 原始腳本就有的既有缺口，不是這次改動造成的。已經在 `migrations/bundle/01_run_first.sql` 裡比照其他表的處理方式補上（開 RLS + 全部允許的 policy），跟專案現有的「RLS 形同虛設但無害」的安全層級一致（見 `docs/SETUP.md` 已知問題 #4），不影響走 `service_role` 的後端邏輯。

## 端到端驗證結果

用真實逐字稿（Eric 訪談，服裝設計師可用性測試，72K 字元原文）跑過一次完整的「教練 HumanAI框架」（7 步、全 collective）：

- 全部 7 步成功完成，無失敗重試
- 總耗時 811 秒（約 13.5 分鐘）
- 總 token 用量 472,585
- 最終產出 8 個 HMW 問句，內容具體對應訪談裡實際提到的功能（Concept Creator、Fabric Library、Model Library 等），不是空泛或虛構的內容

確認整條鏈路（上傳逐字稿 → worker 接單 → Claude API 跑分析 → 前端顯示 HMW 投票結果）是通的。

## 目前的部署狀態

**目前只在本機跑，沒有部署到雲端平台**——因為現階段只是個人測試使用，不需要給外部使用者連線，所以先不處理 `docs/SETUP.md` 的步驟 14-15（正式部署）。本機啟動方式：

```bash
# 終端機 A：dev server
npm run dev

# 終端機 B：worker（必須另開一個，分析才會真的跑）
npm run worker
```

> 這台機器的 Homebrew 版 Node 當時壞過（`ada-url` 依賴版本對不起來，導致 `node` 完全跑不起來），
> 繞過方式是直接抓官方 Node 二進位檔解壓縮使用，跟這次 Claude API 的改動無關，純屬本機環境問題，
> 不影響其他機器照 `docs/SETUP.md` 走。

之後如果要正式部署，`docs/SETUP.md` 的步驟 14 開始適用；平台選擇上，免費又能讓 worker 常駐不休眠的選項不多（Render 的 background worker 要付費、Railway 現在是一次性試用額度），可以考慮 Fly.io 的免費額度，或直接接受 Heroku／Railway／Render 的付費方案。
