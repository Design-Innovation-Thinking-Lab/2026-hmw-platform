/**
 * lib/analysis/smartInject.js
 *
 * 自然語言優先的 Prompt 預處理器。
 *
 * 設計原則：
 * - 自然語言為主 → smartInject 自動偵測關鍵字、附加所需資料區塊
 * - Nunjucks 語法為覆寫 → 作者可用 {{ variable }} 精確控制特定欄位
 * - 不再「只要有 {{ 就完全跳過」；改為逐項檢查「模板是否已明確引用該變數」
 *   若模板已自己注入，就跳過那一項；其餘項目仍由 smartInject 補全
 *
 * 例：模板含 {{ filename }} 但沒有 {{ transcript }}
 *   → smartInject 仍補上逐字稿；filename 保留作者的寫法
 */

// 暗示需要逐字稿的關鍵詞
const TRANSCRIPT_KEYWORDS = [
  '逐字稿', '訪談', '受訪者', '原文', '訪問', 'transcript',
  '原話', '說了什麼', '訪問內容', '受訪內容'
]

// 暗示需要上一步結果的關鍵詞（collective scope）
const PREV_STEP_KEYWORDS = [
  '上一步', '前一步', '上個步', '上步', '已分析', '已歸納',
  '你已經', '根據分析', '根據結果', '根據以上', 'previous step',
  '分析結果', '你對', '根據你', '根據上'
]

/**
 * 判斷模板是否已明確引用某個變數（支援 {{ var }} 和 {{ var | filter }}）
 */
function alreadyHasVar(template, varName) {
  // matches: {{ varName }}, {{ varName | filter }}, {{ varName.field }}
  const pattern = new RegExp(`\\{\\{\\s*${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[|}.]`)
  return pattern.test(template)
}

/**
 * 判斷模板是否已明確使用某個 nunjucks 迴圈標籤
 */
function alreadyHasTag(template, tagContent) {
  return template.includes(tagContent)
}

/**
 * 預處理 prompt template：
 *   1. 偵測自然語言關鍵字 → 附加對應資料區塊
 *   2. 若模板已用 {{ variable }} 明確引用某資料 → 跳過該項目的自動注入
 *   3. 所有模板最終都交由 nunjucksEnv.renderString() 渲染
 *
 * @param {string} template  - DB 中的 prompt_template 原文
 * @param {string} scope     - 'individual' | 'collective'
 * @param {number} stepIndex - 當前步驟的 step_index
 * @returns {string}         - 可傳入 nunjucksEnv.renderString() 的完整模板
 */
export function smartPreprocess(template, scope, stepIndex) {
  if (!template) return template

  const lower = template.toLowerCase()
  const appendParts = []

  // ── 逐項檢查哪些資料已被作者明確引用 ────────────────────────────────────
  const has = {
    transcript:      alreadyHasVar(template, 'transcript'),
    files:           alreadyHasVar(template, 'files') || alreadyHasTag(template, '{% for f in files'),
    prevResults:     alreadyHasVar(template, 'previous_step_all_results'),
    attachmentText:  alreadyHasVar(template, 'attachment_text') || alreadyHasTag(template, '{% if has_attachments'),
  }

  // ── Individual scope：注入當前受訪者逐字稿 ──────────────────────────────
  if (scope === 'individual' && !has.transcript) {
    appendParts.push(`
---
【受訪者逐字稿】
受訪者：{{ filename }}

{{ transcript }}
---`)
  }

  // ── Collective scope：注入上一步所有受訪者的分析結果 ────────────────────
  if (scope === 'collective' && !has.prevResults) {
    appendParts.push(`
---
【上一步驟分析結果（所有受訪者）】
{% if previous_step_all_results and previous_step_all_results | length > 0 %}
{{ previous_step_all_results | tojson }}
{% else %}
（上一步驟無有效分析結果，以下改提供各受訪者逐字稿原文）
{% for f in files %}
=== 受訪者：{{ f.filename }} ===
{{ f.transcript }}

{% endfor %}
{% endif %}
---`)
  }

  // ── Collective scope：若關鍵字暗示也需要逐字稿原文 ──────────────────────
  if (scope === 'collective' && !has.files) {
    const wantsTranscripts = TRANSCRIPT_KEYWORDS.some(k => lower.includes(k))
    if (wantsTranscripts) {
      appendParts.push(`
---
【各受訪者逐字稿全文】
{% for f in files %}
=== 受訪者：{{ f.filename }} ===
{{ f.transcript }}

{% endfor %}
---`)
    }
  }

  // ── 偵測明確的步驟編號引用：步驟2 / 第3步 / Step 4 ──────────────────────
  const stepPattern = /步驟\s*([1-9])|第\s*([1-9])\s*步|[Ss]tep\s*([1-9])/g
  const referencedSteps = new Set()
  for (const match of template.matchAll(stepPattern)) {
    const n = parseInt(match[1] || match[2] || match[3])
    if (!isNaN(n) && n < stepIndex) referencedSteps.add(n)
  }
  for (const n of referencedSteps) {
    // 若作者已用 steps[N] 手動引用，就跳過
    if (!template.includes(`steps[${n}]`)) {
      appendParts.push(`
---
【步驟 ${n} 分析結果】
{{ steps[${n}] | tojson }}
---`)
    }
  }

  // ── 附件內容：有附件時自動插入 ────────────────────────────────────────────
  if (!has.attachmentText) {
    appendParts.push(`
{% if has_attachments %}
---
【步驟附件內容】
{{ attachment_text }}
---
{% endif %}`)
  }

  if (appendParts.length === 0) return template

  // 若模板本身是純自然語言（沒有 {{ }}），補上 JSON 輸出指示
  const hasNunjucks = template.includes('{{') || template.includes('{%')
  const jsonHint = hasNunjucks ? '' : '\n\n請以 JSON 格式輸出結果。'

  return template + jsonHint + appendParts.join('\n')
}
