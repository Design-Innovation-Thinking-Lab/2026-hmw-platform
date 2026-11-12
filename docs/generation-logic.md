# HMW 生成邏輯：從逐字稿到 HMW 卡片的完整路徑

> 寫給要改 prompt、改流程、或單純想搞懂「這系統到底怎麼跑的」的人看。內容全部對照實際程式碼寫成，不是猜測。

## 一、整體資料流

```
使用者上傳逐字稿檔案
  → worker 解析成 transcripts（files: uploaded → processing → parsed）
使用者在研究室選一個分析模式，送出分析
  → analysis_runs 新增一筆 status=pending
worker 輪詢到 pending 的 run，認領（status → processing）
  → runAnalysisFlow() 依照 step_index 順序，依序跑完該模式的每一個步驟
     每一步 = 組 prompt → 呼叫 Claude API → 解析結果 → 寫入 analysis_results
全部步驟跑完 → analysis_runs status → completed
前端 /room/[id] 讀這個 run 「最後一個成功的 collective 步驟」當 HMW 結果、
「倒數第二個」當 JTBD 結果，動態解析成卡片
使用者投票 → 寫入 hmw_votes
```

## 二、三層資料模型

```
projects（= 分析模式，例如「領航員HumanAI框架」）
  └─ analysis_flow_steps（模式底下的步驟，按 step_index 排序）
       ├─ analysis_scope: 'individual' | 'collective'
       ├─ role_id → analysis_roles（這步驟 AI 的人設 / system_prompt）
       ├─ prompt_template（這步驟的 prompt，Nunjucks 語法）
       ├─ output_schema（選填，有填的話強制結構化輸出，見第五節）
       └─ input_step_indices（目前程式碼沒有讀這個欄位做流程控制——
          實際是哪一步能讀到哪些資料，是靠 prompt_template 裡怎麼寫
          {{ previous_step_result }} / {{ steps[n] }} 決定的，不是這個欄位）
```

## 三、三個預設模式的步驟結構

對照 `migrations/bundle/02_run_second.sql` 的 seed 資料實際確認：

| 模式 | 步驟數 | individual 步驟 | collective 步驟 |
|---|---|---|---|
| 領航員 HumanAI框架 | 8 | 5（清稿、身份理解、資料準備、開放編碼、主軸編碼） | 3（選擇性編碼、JTBD、HMW） |
| 教練 HumanAI框架 | 7 | 0 | 7（整理Findings、Summary、Insight、AI自我審視、統整Insight、產出JTBD、產出HMW） |
| 建築師 HumanAI框架 | 4 | 1（[T01]研究背景與資料定義） | 3（[T02]Findings、[T03]JTBD、[T04]HMW） |

individual 步驟會依「逐字稿份數」各跑一次；collective 步驟不管幾份逐字稿都只跑一次，但會把所有逐字稿/前面結果一起餵進去。每個模式的 prompt 實際內容、用了哪些方法論框架、彼此的差異，見 `docs/analysis-modes-comparison.md`；領航員 8 步的逐步 prompt 撰寫細節見 `docs/analysis-steps-guide.md`。

## 四、單一步驟怎麼變成一次 Claude API 呼叫

核心邏輯都在 `lib/analysis/engine.js`。

1. **分流**：`analysis_scope === 'individual'` 走 `processIndividualStep()`（每份逐字稿各跑一次，`ANALYSIS_CONCURRENCY`〔預設 3〕限制同時處理幾份）；`'collective'` 走 `processCollectiveStep()`（只跑一次）。
2. **組 context**：`buildContext()` 準備好這一步可以用的模板變數——`transcript`（個別逐字稿）、`files`（全部逐字稿列表）、`previous_step_result`（上一步對同一份逐字稿/collective 的結果）、`previous_step_all_results`（上一步全部受訪者的結果）、`steps[n]`（第 n 步的結果）、`attachments`／`attachment_text`（這一步後台設定的附件）。
   - 長度保護：`TRANSCRIPT_MAX_CHARS`（預設 40000 字）、`PREV_RESULTS_MAX_CHARS`（60000 字）超過就截斷，並在 log 印出截斷了多少字元。
3. **`smartPreprocess()`（`lib/analysis/smartInject.js`）**：自然語言優先的自動補資料機制。管理員寫 prompt 時不一定會用 `{{ transcript }}` 這種 Nunjucks 語法，系統會檢查 prompt 裡有沒有已經明確引用某個變數（`{{ xxx }}`）或關鍵字（例如「逐字稿」「上一步」），**沒有才自動幫忙補上對應的資料區塊**；已經手動引用的欄位不會被覆蓋或重複注入。
4. **`nunjucksEnv.renderString()`**：把補完的模板套上 context，渲染成最終送給 LLM 的純文字 prompt。
5. **附件處理**：
   - 文字類（PDF / DOCX / CSV / TXT／MD）會被 `attachmentProcessor.js` 轉成文字塞進 `attachment_text`，一起進到 prompt 裡。
   - **圖片不會被轉成文字**——`attachmentProcessor.js` 對圖片只給一個「無法轉換為文字」的佔位字串；真正讓 Claude「看到」圖片，是另一條路徑：`claude.js` 直接把圖片下載、轉 base64，當成真正的視覺輸入（`image` content block）送進 API（見第五節）。
6. **去重／可續跑**：每個 `(step, file)` 或 `(step, collective)` 組合跑之前，會先查 `analysis_results` 有沒有已經成功的紀錄，有就直接跳過。**這就是為什麼「重新執行分析」不會整條重跑**——只有失敗或還沒跑的步驟會重新呼叫 API。
7. **重試**：`withRetry()` 包一層，單一步驟最多重試 3 次（間隔遞增），3 次都失敗才讓整個 run 標記為 `failed`，但已經成功的其他步驟結果不會被清掉。

## 五、呼叫 Claude API 的細節（`lib/llm/claude.js`）

兩種輸出模式：

- **一般情況**（`output_schema` 沒填，目前三個預設模式的步驟都是這種）：在 system prompt 加一句「請以 JSON 格式輸出」，拿到回應後直接 `JSON.parse()`；失敗的話清掉 ` ```json ` 圍欄再試一次；還是失敗才真的當作錯誤。
- **有填 `output_schema`**：用 Anthropic 的 **tool_choice 強制呼叫**——定義一個 `input_schema = output_schema` 的工具，強制模型一定要呼叫這個工具，拿到的 `tool_use.input` 保證符合 schema，不需要再自行解析 JSON 字串（比純文字+parse 更穩，但目前預設 seed 資料沒有任何步驟用到這個欄位）。

兩個實測踩到、已修好的限制（完整除錯過程見 `docs/claude-api-setup-log.md`）：

- `claude-sonnet-5-5` **不接受 `temperature` 參數**，帶了就 400 錯誤——所以 request body 裡沒有這個欄位。
- `max_tokens` 設到 32768 以上時，Anthropic SDK 自己的保護機制會**拒絕用一般的 `messages.create()` 呼叫**（它判斷這個請求可能跑超過 10 分鐘），所以改用 `messages.stream(...).finalMessage()`。

其他：全域 rate limiter（`API_MAX_RPM`，預設 200）、429 限流或空回應/截斷會自動重試（最多 5 次，間隔 5s → 10s → 20s → 40s）。

## 六、worker.js 怎麼驅動整個流程

`server/worker.js` 是一個單純的輪詢迴圈（`WORKER_POLL_INTERVAL_MS`，預設每 5 秒一輪），同時處理兩條獨立隊列：

- **檔案解析**：`files.status = 'uploaded'` → 認領 → `parseFileToParagraphs()` → 寫入 `transcripts` → `status = 'parsed'`
- **分析任務**：`analysis_runs.status = 'pending'` → 認領 → `runAnalysisFlow()` → `status = 'completed'`／`'failed'`

兩條隊列各自有併發上限（`MAX_CONCURRENT_FILES`、`MAX_CONCURRENT_ANALYSES`）。

**孤兒任務復原**：worker 啟動時，會先把所有卡在 `processing`（代表上次 worker 行程被殺掉、沒跑完就留在半路）的 `analysis_runs` 跟 `files`，清掉半成品結果（避免重複/髒資料），打回 `pending`／`uploaded`，下一輪就會被重新認領、乾淨地重跑一次。這就是我們實測時「改完程式碼重啟 worker，中斷的分析自動接手繼續跑」那個機制的由來——但這個設計假設**只有一個 worker 行程**，如果之後 worker 要開多個實例，這段邏輯需要改成心跳/租約機制，不然會互相清掉彼此正在跑的任務。

## 七、最後一步的 JSON 怎麼變成 HMW 投票卡片（`pages/api/rooms/results.js`）

**沒有一個固定 schema 的 `hmw_candidates` 表在存這些卡片**——是前端即時從 JSON 動態解析出來的：

1. 抓這個 run 底下「全部成功的 collective 步驟」，依建立時間排序。
2. **最後一個** = HMW 結果，**倒數第二個** = JTBD 結果。不是寫死某個 `step_index`，所以領航員（8 步）、教練（7 步）、建築師（4 步）這三個步驟數完全不同的模式，可以共用同一套解析邏輯。
3. 用正則 `/hmw|how\s*might\s*we/i` 在結果 JSON 的 key 名稱裡找「看起來是 HMW 清單」的陣列欄位（因為不同模式的 prompt 設計者對 JSON key 命名不統一，例如 `HMW_questions`／`HMW問題`／`hmw`）。
4. **攤平巢狀結構**：有些模式的輸出是「一個 JTBD 底下好幾句 HMW 字串」或「好幾個 HMW 物件」巢狀在一起，這段邏輯會把它攤平成「一張卡 = 一個 HMW」，並把父層的上下文（例如對應的 JTBD）一起帶過去。
5. 投票寫進 `hmw_votes`，key 是 `room_id + user_id + hmw_index + analysis_run_id`。**`hmw_index` 只是陣列索引，不是穩定 ID**——同一個研究室重新跑一次分析，HMW 的順序或內容可能會變，舊的投票是用舊的 index 對應舊的內容，不會自動跟著遷移。

## 八、容錯設計小結

| 情況 | 怎麼處理 |
|---|---|
| LLM 回傳不是合法 JSON | 清掉 ` ```json ` 圍欄再試一次解析，還是不行才當錯誤重試整個 API 呼叫 |
| 回應被截斷（`stop_reason: max_tokens`） | 當作失敗，進入重試流程（最多 5 次） |
| 429 限流 | 讀 `Retry-After`（或指數退避）等待後重試 |
| 單一步驟重試 3 次都失敗 | 整個 run 標記 `failed`，但已完成步驟的結果保留在 `analysis_results`，不會被清掉 |
| worker 行程被殺掉（部署重啟、崩潰） | 下次啟動自動偵測卡在 `processing` 的孤兒任務，清掉半成品，重新排進隊列乾淨重跑 |
| 「重新執行分析」 | 不是整條重跑——已經成功的 `(step, file)` 組合會被跳過，只重跑失敗/沒跑過的部分 |
