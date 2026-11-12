# Prompt 模板變數指南

本文檔詳細說明後台 Prompt Template 可使用的所有變數、資料結構及使用範例。

> 📌 **模板語法**：使用 [Nunjucks](https://mozilla.github.io/nunjucks/) 模板引擎

---

## 目錄

1. [基礎變數](#基礎變數)
2. [跨步驟結果變數](#跨步驟結果變數)
3. [檔案列表變數](#檔案列表變數)
4. [步驟資訊變數](#步驟資訊變數)
5. [系統自動注入資訊](#系統自動注入資訊)
6. [使用範例](#使用範例)
7. [常見問題](#常見問題)

---

## 基礎變數

用於 **Individual 步驟**，處理單一逐字稿時使用。

### `{{ transcript }}`

**說明**：當前逐字稿的完整內容

**資料類型**：`string`

**適用範圍**：Individual 步驟

**資料格式**：
```
Speaker: 第一段內容...

Speaker: 第二段內容...
```

**使用範例**：
```
請分析以下逐字稿：
{{ transcript }}
```

---

### `{{ filename }}`

**說明**：當前逐字稿的檔案名稱

**資料類型**：`string`

**適用範圍**：Individual 步驟

**使用範例**：
```
【受訪者 {{ filename }} 逐字稿】
{{ transcript }}
```

---

### `{{ file_meta }}`

**說明**：檔案元資料物件

**資料類型**：`object`

**適用範圍**：Individual 步驟

**資料結構**：
```json
{
  "uploader_id": "使用者 ID",
  "created_at": "2026-01-20T10:00:00Z"
}
```

**使用範例**：
```
上傳者：{{ file_meta.uploader_id }}
建立時間：{{ file_meta.created_at }}
```

---

## 跨步驟結果變數

用於取得前面步驟的分析結果。

### `{{ previous_step_result }}`

**說明**：上一步驟的分析結果（對應同一逐字稿）

**資料類型**：`object` 或 `string`（視 LLM 輸出而定）

**適用範圍**：Step 2 以後的所有步驟

**運作邏輯**：
- **Individual 步驟**：取得同一逐字稿在上一步的結果
- **Collective 步驟**：取得上一步 collective 的結果

**使用範例**：
```
以下是上一步的分析結果：
{{ previous_step_result }}

請根據上述結果進行下一步分析...
```

**JSON 物件存取**：
```
{% if previous_step_result.table %}
表格資料如下：
{{ previous_step_result.table | dump }}
{% endif %}
```

---

### `{{ previous_step_all_results }}`

**說明**：上一步所有逐字稿的結果清單

**資料類型**：`array`

**適用範圍**：Collective 步驟（Step 6, 7, 8）

**資料結構**：
```json
[
  { "fileId": "abc123...", "result": { ... } },
  { "fileId": "def456...", "result": { ... } }
]
```

**使用範例（迴圈）**：
```
以下是各受訪者的分析結果：

{% for item in previous_step_all_results %}
### 受訪者 {{ loop.index }}
{{ item.result | dump }}

{% endfor %}
```

**迴圈內可用變數**：
- `{{ loop.index }}` - 當前項目序號（從 1 開始）
- `{{ loop.index0 }}` - 當前項目序號（從 0 開始）
- `{{ loop.first }}` - 是否為第一項
- `{{ loop.last }}` - 是否為最後一項

---

### `{{ steps[N] }}`

**說明**：取得第 N 步的分析結果

**資料類型**：`object` 或 `array`

**適用範圍**：所有步驟（N < 當前步驟）

> ⚠️ **重要**：必須使用 `steps[N]` 括號語法，不能用 `steps.N`！

**運作邏輯**：
- 若 Step N 是 **Individual**：回傳陣列 `[{ file_id, result }, ...]`
- 若 Step N 是 **Collective**：回傳該步驟的結果物件

**使用範例**：
```
參考 Step 3 的分段資料：
{{ steps[3] | dump }}

參考 Step 6 的選擇性編碼結果：
{{ steps[6] | dump }}
```

---

## 檔案列表變數

### `{{ files }}`

**說明**：所有逐字稿檔案的完整資訊

**資料類型**：`array`

**適用範圍**：Collective 步驟

**資料結構**：
```json
[
  {
    "id": "abc123...",
    "filename": "逐字稿A",
    "transcript": "完整逐字稿內容..."
  },
  {
    "id": "def456...",
    "filename": "逐字稿B",
    "transcript": "完整逐字稿內容..."
  }
]
```

**使用範例**：
```
本次分析包含以下逐字稿：
{% for file in files %}
- {{ file.filename }}
{% endfor %}
```

---

### `{{ all_filenames }}`

**說明**：所有逐字稿檔案名稱的陣列

**資料類型**：`array<string>`

**適用範圍**：所有步驟

**資料結構**：
```json
["逐字稿A", "逐字稿B", "逐字稿C"]
```

**使用範例**：
```
可用的受訪者來源（僅能引用以下名稱）：
{% for name in all_filenames %}
{{ loop.index }}. {{ name }}
{% endfor %}
```

---

### `{{ file_count }}`

**說明**：逐字稿總數

**資料類型**：`number`

**適用範圍**：所有步驟

**使用範例**：
```
本次分析共有 {{ file_count }} 份逐字稿。
```

---

## 步驟資訊變數

### `{{ current_step }}`

**說明**：當前步驟的資訊

**資料類型**：`object`

**資料結構**：
```json
{
  "index": 3,
  "title": "資料準備",
  "scope": "individual"
}
```

**使用範例**：
```
目前執行：Step {{ current_step.index }} - {{ current_step.title }}
分析類型：{{ current_step.scope }}
```

---

## 系統自動注入資訊

以下資訊會**自動注入到 System Prompt**，不需要手動在 Prompt Template 中添加：

### 研究背景資訊

系統會自動從房間設定中取得並注入：

```
【研究背景資訊】
研究主題：[房間設定的 research_topic]
研究目的：[房間設定的 research_purpose]

【受訪者/逐字稿列表】共 N 份
1. 逐字稿A
2. 逐字稿B
...

⚠️ 重要：引用來源時，只能使用上方列出的實際受訪者/檔案名稱，不可虛構或使用不存在的名稱。

請在分析過程中始終以上述研究目的為導向。

【語言要求】請全程使用繁體中文回覆。
```

---

## 使用範例

### 範例 1：Individual 步驟（Step 1 清稿）
```
請幫我檢查以下逐字稿是否有遺漏、錯字、聽錯。

---
【受訪者 {{ filename }} 逐字稿】
{{ transcript }}
---

【輸出格式】請以 JSON 格式輸出：
{
  "受訪者": "{{ filename }}",
  "清稿後逐字稿": [...],
  "修正說明": [...]
}
```

### 範例 2：Individual 步驟（使用前步結果）
```
以下是 {{ filename }} 的開放性編碼結果：
{{ previous_step_result | dump }}

請根據上述編碼，歸納成較高層次的主題。
```

### 範例 3：Collective 步驟（整合所有結果）
```
以下是各受訪者的主軸編碼結果：

{% for item in previous_step_all_results %}
### 受訪者 {{ loop.index }}
{{ item.result | dump }}

{% endfor %}

請整合上述結果，進行選擇性編碼分析。

【可用的受訪者來源】
{% for name in all_filenames %}
- {{ name }}
{% endfor %}
```

### 範例 4：使用歷史步驟結果
```
以下是選擇性編碼結果（Step 6）：
{{ previous_step_result | dump }}

參考 Step 3 的原始分段資料：
{{ steps[3] | dump }}

請將核心主題轉換為 JTBD。
```

### 範例 5：同時使用多個前步驟結果 ⭐ (重要)

適用情境：Step 3 需要同時參考 Step 1（清稿結果）和 Step 2（角色理解）

> ⚠️ `{{ previous_step_result }}` 只會取得**上一步**的結果。
> 若需要取得更早步驟的結果，請使用 `{{ steps.N }}`。

**Step 3 範例 Prompt：**
```
本步驟目的建立可分析的逐字稿段落表格，方便後續編碼。

【分析角色參照】
{{ steps[2] | dump }}

【清稿後的逐字稿內容】受訪者：{{ filename }}
{{ steps[1] | dump }}

請依照以下步驟進行：
1. 詳細閱讀上方清稿後的逐字稿，並根據研究目的了解後續分析的核心
2. 將訪談原始資料依照內容主題分段，請避免更改原話內容
3. 將結果依表格顯示：段落簡述(100字內) | 訪談者問題 | 受訪者回話

訪談的語句需要標記角色、原話、時間點（格式如：陳小姐 因為那個什麼戰後嬰兒潮... 00:00:47）
```

**變數說明：**
| 變數 | 取得內容 |
|------|----------|
| `{{ steps[1] }}` | Step 1 的清稿結果（含完整逐字稿內容） |
| `{{ steps[2] }}` | Step 2 的角色理解 |
| `{{ previous_step_result }}` | Step 2 的結果（等同 `{{ steps[2] }}`） |

---

## Nunjucks 常用語法

### 條件判斷
```
{% if previous_step_result %}
有上一步結果
{% else %}
沒有上一步結果
{% endif %}
```

### 迴圈
```
{% for item in previous_step_all_results %}
{{ loop.index }}. {{ item.result | dump }}
{% endfor %}
```

### 過濾器
- `{{ data | dump }}` - 將物件轉為 JSON 字串
- `{{ text | trim }}` - 去除前後空白
- `{{ text | upper }}` - 轉大寫
- `{{ text | lower }}` - 轉小寫
- `{{ list | length }}` - 取得陣列長度
- `{{ list | first }}` - 取得第一項
- `{{ list | last }}` - 取得最後一項

---

## 常見問題

### Q1: 為什麼 `{{ previous_step_result }}` 是空的？
**A**: 第一個步驟沒有前步結果。請確認：
- 當前步驟是 Step 2 以後
- 上一步已成功執行

### Q2: 如何在 Collective 步驟取得原始逐字稿？
**A**: 使用 `{{ files }}` 變數：
```
{% for file in files %}
【{{ file.filename }}】
{{ file.transcript }}
{% endfor %}
```

### Q3: 來源檔案名稱出現虛構名稱怎麼辦？
**A**: 系統已自動在 System Prompt 中注入實際檔案名稱列表並警告 LLM 不可虛構。也可在 Prompt 中強調：
```
⚠️ 只能使用以下來源名稱：{{ all_filenames | join(', ') }}
```

### Q4: 如何確保 LLM 輸出繁體中文？
**A**: 系統已自動在 System Prompt 中加入「【語言要求】請全程使用繁體中文回覆。」

### Q5: 如何調試變數內容？
**A**: 使用 `| dump` 過濾器查看完整資料：
```
DEBUG: {{ previous_step_result | dump }}
```

---

## 變數速查表

| 變數 | 類型 | 適用範圍 | 說明 |
|------|------|----------|------|
| `{{ transcript }}` | string | Individual | 當前逐字稿內容 |
| `{{ filename }}` | string | Individual | 當前檔案名稱 |
| `{{ file_meta }}` | object | Individual | 檔案元資料 |
| `{{ previous_step_result }}` | any | Step 2+ | 上一步結果 |
| `{{ previous_step_all_results }}` | array | Collective | 所有結果陣列 |
| `{{ steps.N }}` | any | Step N < current | 第 N 步結果 |
| `{{ files }}` | array | Collective | 所有檔案資訊 |
| `{{ all_filenames }}` | array | All | 所有檔案名稱 |
| `{{ file_count }}` | number | All | 逐字稿總數 |
| `{{ current_step }}` | object | All | 當前步驟資訊 |
