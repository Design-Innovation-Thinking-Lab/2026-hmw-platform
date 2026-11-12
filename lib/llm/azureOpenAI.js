import { AzureOpenAI } from 'openai'
import { apiRateLimiter } from './rateLimiter.js'

// Lazy-initialize Azure OpenAI client
let _client = null
function getClient() {
  if (!_client) {
    const apiKey = process.env.AZURE_OPENAI_API_KEY
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT
    if (!apiKey) throw new Error('AZURE_OPENAI_API_KEY is not set in environment variables')
    if (!endpoint) throw new Error('AZURE_OPENAI_ENDPOINT is not set in environment variables')

    _client = new AzureOpenAI({
      endpoint,
      apiKey,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview',
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT
    })
  }
  return _client
}

// Retry configuration
const MAX_RETRIES = 5
const INITIAL_DELAY_MS = 5000

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function parseRetryDelay(error) {
  // Azure returns "Retry-After: N" or "retry after N seconds" in the error
  const match = error.message?.match(/retry after (\d+) second/i) ||
                error.message?.match(/Retry-After:\s*(\d+)/i)
  if (match) return parseInt(match[1]) * 1000 + 1000
  return null
}

/**
 * Call Azure OpenAI with a prompt and optional system prompt.
 * Drop-in replacement for lib/llm/gemini.js – same function signature.
 * Includes automatic retry with exponential backoff for rate limiting.
 * Supports image attachments (JPEG, PNG, GIF, WEBP).
 *
 * @param {Object} params
 * @param {string} params.prompt - The main user prompt
 * @param {string} [params.systemPrompt] - Optional system instruction
 * @param {Object} [params.jsonSchema] - Optional JSON schema (added to prompt)
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
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT
  let lastError = null

  // Use structured outputs (json_schema) when a schema is provided.
  // This guarantees schema-compliant JSON from the API, eliminating parse failures.
  const useStructuredOutput = !!jsonSchema
  let responseFormat
  if (useStructuredOutput) {
    responseFormat = {
      type: 'json_schema',
      json_schema: {
        name: 'analysis_result',
        strict: false,
        schema: jsonSchema
      }
    }
  } else {
    responseFormat = { type: 'json_object' }
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // ── Build messages array ──────────────────────────────────────────
      const messages = []

      // Build system message
      const jsonInstruction = '請以 JSON 格式（valid JSON）輸出你的回答。'
      if (systemPrompt) {
        messages.push({ role: 'system', content: `${systemPrompt}\n\n${jsonInstruction}` })
      } else {
        messages.push({ role: 'system', content: jsonInstruction })
      }

      // Build user prompt text
      let finalPrompt = prompt
      // When using json_object fallback, include schema hint in prompt
      if (jsonSchema && !useStructuredOutput) {
        finalPrompt += `\n\nOutput must be valid JSON matching this schema:\n${JSON.stringify(jsonSchema, null, 2)}`
      }


      // Process image attachments (Azure GPT-4o supports image URLs)
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
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64}` }
            })
            console.log(`   ✓ Loaded image ${attachment.file_name}`)
          } catch (err) {
            console.warn(`   ⚠️  Error processing ${attachment.file_name}:`, err.message)
          }
        }
      }

      // Compose user message content
      const userContent = imageParts.length > 0
        ? [{ type: 'text', text: finalPrompt }, ...imageParts]
        : finalPrompt

      messages.push({ role: 'user', content: userContent })

      // ── Rate limiter ──────────────────────────────────────────────────
      await apiRateLimiter.acquire()

      // ── API call ──────────────────────────────────────────────────────
      const maxTokens = parseInt(process.env.AZURE_MAX_COMPLETION_TOKENS || '32768')
      const response = await getClient().chat.completions.create({
        model: deployment,
        messages,
        response_format: responseFormat,
        temperature,
        max_completion_tokens: maxTokens
      })

      const choice = response.choices[0]
      const finishReason = choice?.finish_reason
      const text = choice?.message?.content || ''

      // ── Diagnose empty / filtered responses ──────────────────────────
      if (!text) {
        console.warn(`⚠️  Empty response from Azure OpenAI`)
        console.warn(`   finish_reason : ${finishReason}`)
        console.warn(`   prompt_tokens : ${response.usage?.prompt_tokens}`)
        console.warn(`   completion_tokens: ${response.usage?.completion_tokens}`)
        if (finishReason === 'content_filter') {
          throw new Error('Azure Content Safety filtered this response. Check the transcript content.')
        }
        if (finishReason === 'length') {
          // Response was cut off — text is empty because the incomplete JSON
          // couldn't be returned. Retry won't help unless we reduce prompt size.
          console.warn(`   ⚠️  max_completion_tokens (${response.usage?.completion_tokens}) reached.`)
          console.warn(`      Try increasing AZURE_MAX_COMPLETION_TOKENS or reducing TRANSCRIPT_MAX_CHARS.`)
          throw new Error('Response cut off: max_completion_tokens reached.')
        }
      } else {
        if (finishReason === 'length') {
          console.warn(`⚠️  finish_reason=length: response may be truncated (${response.usage?.completion_tokens} tokens used)`)
        } else if (finishReason && finishReason !== 'stop') {
          console.warn(`⚠️  Unexpected finish_reason: ${finishReason}`)
        }
      }

      // Token usage
      const usage = {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0
      }

      // ── Parse JSON ────────────────────────────────────────────────────
      let result
      try {
        result = JSON.parse(text)
      } catch (e) {
        console.warn('Azure OpenAI response was not valid JSON, attempting cleanup')
        console.warn('   Raw response (first 300 chars):', text.slice(0, 300))
        const clean = text.replace(/```json\n|```/g, '').trim()
        try {
          result = JSON.parse(clean)
        } catch (e2) {
          // Invalid JSON is often transient — retry if we have attempts left
          if (attempt < MAX_RETRIES - 1) {
            const delay = INITIAL_DELAY_MS * Math.pow(2, attempt)
            console.warn(`⟳  Invalid JSON response. Retrying in ${Math.round(delay / 1000)}s... (attempt ${attempt + 1}/${MAX_RETRIES})`)
            await sleep(delay)
            continue
          }
          result = { error: 'Invalid JSON', raw: text }
        }
      }

      return { result, usage }

    } catch (error) {
      lastError = error
      const isRateLimited =
        error.status === 429 ||
        error.message?.includes('429') ||
        error.message?.includes('Too Many Requests') ||
        error.message?.includes('quota') ||
        error.message?.includes('Rate limit')

      const isEmptyResponse =
        error.message?.includes('Empty response') ||
        error.message?.includes('max_completion_tokens reached')

      // Retry on rate limit and empty/truncated responses
      const shouldRetry = (isRateLimited || isEmptyResponse) && attempt < MAX_RETRIES - 1

      if (shouldRetry) {
        const suggestedDelay = parseRetryDelay(error)
        const delay = suggestedDelay || (INITIAL_DELAY_MS * Math.pow(2, attempt))
        const reason = isRateLimited ? 'Rate limited' : 'Empty response'
        console.log(`⏳ ${reason}. Retrying in ${Math.round(delay / 1000)}s... (attempt ${attempt + 1}/${MAX_RETRIES})`)
        await sleep(delay)
        continue
      }

      console.error('Azure OpenAI Error:', {
        status: error.status,
        message: error.message,
        code: error.code,
        type: error.type,
        body: error.error || error.body || null
      })
      throw error
    }
  }

  throw lastError
}
