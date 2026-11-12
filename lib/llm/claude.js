import Anthropic from '@anthropic-ai/sdk'
import { apiRateLimiter } from './rateLimiter.js'

// Lazy-initialize Anthropic client
let _client = null
function getClient() {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set in environment variables')
    _client = new Anthropic({ apiKey, maxRetries: 0 }) // we handle retries ourselves, same as azureOpenAI.js
  }
  return _client
}

// Retry configuration (mirrors lib/llm/azureOpenAI.js)
const MAX_RETRIES = 5
const INITIAL_DELAY_MS = 5000

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function parseRetryDelay(error) {
  // Anthropic returns a Retry-After header on 429s
  const retryAfter = error?.headers?.['retry-after']
  if (retryAfter) return parseInt(retryAfter) * 1000 + 1000
  const match = error.message?.match(/retry after (\d+) second/i)
  if (match) return parseInt(match[1]) * 1000 + 1000
  return null
}

const RESULT_TOOL_NAME = 'emit_result'

/**
 * Call Claude (Anthropic API) with a prompt and optional system prompt.
 * Drop-in replacement for lib/llm/azureOpenAI.js – same function signature.
 * Includes automatic retry with exponential backoff for rate limiting.
 * Supports image attachments (JPEG, PNG, GIF, WEBP).
 *
 * @param {Object} params
 * @param {string} params.prompt - The main user prompt
 * @param {string} [params.systemPrompt] - Optional system instruction
 * @param {Object} [params.jsonSchema] - Optional JSON schema (enforced via forced tool use)
 * @param {number} [params.temperature] - 0.0 to 1.0
 * @param {Array}  [params.attachments] - Optional attachments from Supabase Storage
 * @param {Function} [params.supabaseAdmin] - Supabase admin client for downloading attachments
 * @returns {Promise<{result: any, usage: {promptTokens, completionTokens, totalTokens}}>}
 */
export async function generateContent({
  prompt,
  systemPrompt,
  jsonSchema,
  temperature = 0.5,
  attachments = [],
  supabaseAdmin = null
}) {
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5'
  const maxTokens = parseInt(process.env.ANTHROPIC_MAX_TOKENS || '32768')
  let lastError = null

  // Structured output: when a schema is given, force a tool call whose input
  // must match it — this guarantees schema-compliant JSON, same intent as
  // Azure's json_schema response_format. Otherwise fall back to a plain JSON
  // instruction + best-effort parse (same as Azure's json_object fallback).
  const useStructuredOutput = !!jsonSchema

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const jsonInstruction = '請以 JSON 格式（valid JSON）輸出你的回答。'
      const system = systemPrompt ? `${systemPrompt}\n\n${jsonInstruction}` : jsonInstruction

      let finalPrompt = prompt
      if (jsonSchema && !useStructuredOutput) {
        finalPrompt += `\n\nOutput must be valid JSON matching this schema:\n${JSON.stringify(jsonSchema, null, 2)}`
      }

      // Process image attachments (Claude supports image content blocks)
      const imageParts = []
      if (attachments && attachments.length > 0 && supabaseAdmin) {
        console.log(`   📎 Processing ${attachments.length} attachment(s)...`)
        for (const attachment of attachments) {
          const mimeType = attachment.mime_type || ''
          if (!mimeType.startsWith('image/')) {
            console.log(`   ⏭️  Skipping non-image attachment: ${attachment.file_name} (${mimeType})`)
            continue
          }
          try {
            const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'uploads'
            const { data: fileData, error: downloadError } = await supabaseAdmin.storage
              .from(bucket)
              .download(attachment.storage_path)

            if (downloadError) {
              console.warn(`   ⚠️  Failed to download ${attachment.file_name}:`, downloadError)
              continue
            }

            const buffer = await fileData.arrayBuffer()
            const base64 = Buffer.from(buffer).toString('base64')
            imageParts.push({
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: base64 }
            })
            console.log(`   ✓ Loaded image ${attachment.file_name}`)
          } catch (err) {
            console.warn(`   ⚠️  Error processing ${attachment.file_name}:`, err.message)
          }
        }
      }

      const userContent = imageParts.length > 0
        ? [{ type: 'text', text: finalPrompt }, ...imageParts]
        : finalPrompt

      const messages = [{ role: 'user', content: userContent }]

      const requestBody = {
        model,
        max_tokens: maxTokens,
        system,
        messages
        // `temperature` intentionally omitted: claude-sonnet-5-5 rejects the
        // request outright with "temperature: Extra inputs are not permitted"
        // (confirmed via direct API test) — this model has deprecated the param.
      }

      if (useStructuredOutput) {
        requestBody.tools = [{
          name: RESULT_TOOL_NAME,
          description: '輸出符合指定 schema 的分析結果',
          input_schema: jsonSchema
        }]
        requestBody.tool_choice = { type: 'tool', name: RESULT_TOOL_NAME }
      }

      // ── Rate limiter ──────────────────────────────────────────────────
      await apiRateLimiter.acquire()

      // ── API call ──────────────────────────────────────────────────────
      // Streamed: with max_tokens this high, the SDK refuses a plain
      // non-streaming call outright (it estimates the request could run
      // past its timeout and throws before sending anything). stream()
      // + finalMessage() gives back the same shape as create() once done.
      const response = await getClient().messages.stream(requestBody).finalMessage()

      const stopReason = response.stop_reason
      const usage = {
        promptTokens: response.usage?.input_tokens || 0,
        completionTokens: response.usage?.output_tokens || 0,
        totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
      }

      // ── Extract result ───────────────────────────────────────────────
      let result
      if (useStructuredOutput) {
        const toolUse = response.content?.find(block => block.type === 'tool_use' && block.name === RESULT_TOOL_NAME)
        if (!toolUse) {
          console.warn(`⚠️  Claude did not return the expected tool_use block`)
          console.warn(`   stop_reason: ${stopReason}`)
          if (stopReason === 'max_tokens') {
            throw new Error('Response cut off: max_tokens reached.')
          }
          result = { error: 'Missing tool_use block', raw: JSON.stringify(response.content) }
        } else {
          result = toolUse.input
        }
      } else {
        const text = response.content?.find(block => block.type === 'text')?.text || ''

        if (!text) {
          console.warn(`⚠️  Empty response from Claude`)
          console.warn(`   stop_reason: ${stopReason}`)
          if (stopReason === 'max_tokens') {
            throw new Error('Response cut off: max_tokens reached.')
          }
        }

        try {
          result = JSON.parse(text)
        } catch (e) {
          console.warn('Claude response was not valid JSON, attempting cleanup')
          console.warn('   Raw response (first 300 chars):', text.slice(0, 300))
          const clean = text.replace(/```json\n|```/g, '').trim()
          try {
            result = JSON.parse(clean)
          } catch (e2) {
            if (attempt < MAX_RETRIES - 1) {
              const delay = INITIAL_DELAY_MS * Math.pow(2, attempt)
              console.warn(`⟳  Invalid JSON response. Retrying in ${Math.round(delay / 1000)}s... (attempt ${attempt + 1}/${MAX_RETRIES})`)
              await sleep(delay)
              continue
            }
            result = { error: 'Invalid JSON', raw: text }
          }
        }
      }

      if (stopReason === 'max_tokens' && result) {
        console.warn(`⚠️  stop_reason=max_tokens: response may be truncated (${usage.completionTokens} tokens used)`)
      }

      return { result, usage }

    } catch (error) {
      lastError = error
      const isRateLimited =
        error.status === 429 ||
        error.message?.includes('429') ||
        error.message?.includes('Too Many Requests') ||
        error.message?.includes('rate_limit') ||
        error.message?.includes('overloaded')

      const isEmptyResponse =
        error.message?.includes('Empty response') ||
        error.message?.includes('max_tokens reached')

      const shouldRetry = (isRateLimited || isEmptyResponse) && attempt < MAX_RETRIES - 1

      if (shouldRetry) {
        const suggestedDelay = parseRetryDelay(error)
        const delay = suggestedDelay || (INITIAL_DELAY_MS * Math.pow(2, attempt))
        const reason = isRateLimited ? 'Rate limited' : 'Empty response'
        console.log(`⏳ ${reason}. Retrying in ${Math.round(delay / 1000)}s... (attempt ${attempt + 1}/${MAX_RETRIES})`)
        await sleep(delay)
        continue
      }

      console.error('Claude (Anthropic) Error:', {
        status: error.status,
        message: error.message,
        type: error.type,
        body: error.error || error.body || null
      })
      throw error
    }
  }

  throw lastError
}
