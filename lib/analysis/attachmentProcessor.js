/**
 * lib/analysis/attachmentProcessor.js
 *
 * Downloads step attachments from Supabase Storage and converts them to
 * plain text / Markdown so the content can be injected into AI prompts.
 *
 * Supported formats:
 *   PDF          → plain text (via pdf-parse)
 *   DOCX / DOC   → plain text (via mammoth)
 *   CSV          → Markdown table
 *   TXT / MD     → read as-is
 *   Images       → placeholder note (binary, can't convert to text here)
 *   Other        → best-effort UTF-8 decode, otherwise placeholder
 */

import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import { createClient } from '@supabase/supabase-js'

const STORAGE_BUCKET = 'analysis-files'

// Max chars per attachment to avoid blowing up the context window
const MAX_ATTACHMENT_CHARS = parseInt(process.env.ATTACHMENT_MAX_CHARS || '20000')

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    )
}

function truncate(text, max, label) {
    if (!text || text.length <= max) return text
    console.warn(`   ✂️  Truncating attachment "${label}": ${text.length} → ${max} chars`)
    return text.slice(0, max) + `\n...[truncated ${text.length - max} chars]`
}

/**
 * Convert a CSV string to a Markdown table.
 */
function csvToMarkdown(csvText) {
    const lines = csvText.trim().split('\n').filter(l => l.trim())
    if (lines.length === 0) return ''

    const parseRow = (line) =>
        line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))

    const rows = lines.map(parseRow)
    const header = rows[0]
    const separator = header.map(() => '---')
    const body = rows.slice(1)

    return [
        '| ' + header.join(' | ') + ' |',
        '| ' + separator.join(' | ') + ' |',
        ...body.map(r => '| ' + r.join(' | ') + ' |')
    ].join('\n')
}

/**
 * Download one attachment from Supabase Storage and convert to Markdown text.
 *
 * @param {Object} attachment  - Row from analysis_step_attachments
 * @returns {Object}           - { filename, description, format, markdown }
 */
export async function processAttachment(attachment) {
    const { storage_path, file_name, mime_type, description } = attachment

    console.log(`   📎 Processing attachment: ${file_name} (${mime_type || 'unknown type'})`)

    try {
        // ── Download from Supabase Storage ───────────────────────────────
        const supabase = getSupabaseAdmin()
        const { data: blob, error } = await supabase.storage
            .from(STORAGE_BUCKET)
            .download(storage_path)

        if (error || !blob) {
            console.warn(`   ⚠️  Failed to download ${file_name}:`, error?.message)
            return { filename: file_name, description, format: 'error', markdown: null, error: error?.message }
        }

        const buffer = Buffer.from(await blob.arrayBuffer())
        const mime = (mime_type || '').toLowerCase()
        const name = (file_name || '').toLowerCase()

        let markdown = null
        let format = 'unknown'

        // ── PDF ──────────────────────────────────────────────────────────
        if (mime.includes('pdf') || name.endsWith('.pdf')) {
            const parsed = await pdfParse(buffer)
            markdown = parsed.text?.trim() || null
            format = 'pdf'
        }

        // ── Word Document (DOCX / DOC) ───────────────────────────────────
        else if (
            mime.includes('wordprocessingml') ||
            mime.includes('msword') ||
            name.endsWith('.docx') || name.endsWith('.doc')
        ) {
            const result = await mammoth.extractRawText({ buffer })
            markdown = result.value?.trim() || null
            format = 'docx'
        }

        // ── CSV ──────────────────────────────────────────────────────────
        else if (mime.includes('csv') || name.endsWith('.csv')) {
            markdown = csvToMarkdown(buffer.toString('utf-8'))
            format = 'csv'
        }

        // ── Plain text / Markdown ────────────────────────────────────────
        else if (
            mime.startsWith('text/') ||
            name.match(/\.(txt|md|markdown|json|yaml|yml)$/)
        ) {
            markdown = buffer.toString('utf-8').trim()
            format = 'text'
        }

        // ── Image ────────────────────────────────────────────────────────
        else if (mime.startsWith('image/')) {
            // Images can't be converted to text without a Vision API call.
            // Insert a placeholder; prompt authors should note this limitation.
            markdown = `[圖片附件：${file_name}${description ? ' — ' + description : ''}]\n（此為圖片檔案，無法自動轉換為文字）`
            format = 'image'
        }

        // ── Fallback: try UTF-8 decode ───────────────────────────────────
        else {
            try {
                const text = buffer.toString('utf-8').trim()
                // Heuristic: if more than 20% of chars are replacement chars, treat as binary
                const replacements = (text.match(/\uFFFD/g) || []).length
                if (replacements / text.length > 0.2) {
                    markdown = `[二進位附件：${file_name}（${mime_type}）— 無法轉換為文字]`
                    format = 'binary'
                } else {
                    markdown = text
                    format = 'text'
                }
            } catch {
                markdown = `[無法解析的附件：${file_name}（${mime_type}）]`
                format = 'binary'
            }
        }

        if (markdown) {
            markdown = truncate(markdown, MAX_ATTACHMENT_CHARS, file_name)
        }

        console.log(`   ✅ ${file_name}: ${format}, ${markdown?.length ?? 0} chars`)
        return { filename: file_name, description: description || null, format, markdown }

    } catch (err) {
        console.warn(`   ❌ Error processing attachment ${file_name}:`, err.message)
        return { filename: file_name, description, format: 'error', markdown: null, error: err.message }
    }
}

/**
 * Process all attachments for a step and return an array of results.
 * Successfully converted attachments have a non-null `markdown` field.
 */
export async function processAttachments(attachments) {
    if (!attachments || attachments.length === 0) return []
    return Promise.all(attachments.map(a => processAttachment(a)))
}
