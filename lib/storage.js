/**
 * lib/storage.js — Supabase Storage（只能在伺服器端使用）
 *
 * bucket 是私人的：瀏覽器不能直接讀寫，一律由 API 先檢查權限，再發
 *   - signed upload URL（createSignedUploadUrl）：瀏覽器直接把檔案傳到 Storage，
 *     不經過 Vercel API（Vercel 的 API 一次最多只收 4.5 MB）
 *   - signed URL（createSignedUrl）：短時間有效的讀取網址
 *
 * 物件路徑的格式決定誰能讀寫（見 authorizeObjectPath）：
 *   <projectId>/step-images/<uuid>.<ext>      分析步驟的範例圖片
 *   step-attachments/<stepId>/<uuid>.<ext>    分析步驟的附件（會送進 LLM）
 *   rooms/<roomId>/uploads/<uuid>.<ext>       研究室上傳的逐字稿原始檔（解析完就刪除）
 */
import crypto from 'crypto'
import mammoth from 'mammoth'
import pdfParse from 'pdf-parse'
import { supabaseAdmin, canEditProject, projectIdOfStep, canViewRoom, isRoomMember } from './auth'

export const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'uploads'

// signed URL 的有效時間（秒）
export const SIGNED_URL_TTL = 10 * 60

const UUID_RE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

export const UPLOAD_RULES = {
    'step-image': {
        exts: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        maxBytes: 5 * 1024 * 1024,
    },
    'step-attachment': {
        exts: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'txt', 'docx'],
        maxBytes: 3 * 1024 * 1024,
    },
    'transcript': {
        exts: ['txt', 'docx', 'pdf'],
        maxBytes: 50 * 1024 * 1024,
    },
}

export function fileExtension(fileName) {
    const m = String(fileName || '').toLowerCase().match(/\.([a-z0-9]+)$/)
    return m ? m[1] : ''
}

/**
 * 依用途檢查權限並產生物件路徑。回傳 { path } 或 { status, error }。
 */
export async function planUpload(user, { purpose, projectId, stepId, roomId, fileName, size }) {
    const rule = UPLOAD_RULES[purpose]
    if (!rule) return { status: 400, error: '不支援的上傳用途' }

    const ext = fileExtension(fileName)
    if (!rule.exts.includes(ext)) {
        return { status: 400, error: `不支援 .${ext || '?'} 格式（可用：${rule.exts.join('、')}）` }
    }
    const bytes = Number(size)
    if (!Number.isFinite(bytes) || bytes <= 0) return { status: 400, error: '缺少檔案大小' }
    if (bytes > rule.maxBytes) {
        return { status: 400, error: `檔案不能超過 ${Math.round(rule.maxBytes / 1024 / 1024)} MB` }
    }

    const name = `${crypto.randomUUID()}.${ext}`

    if (purpose === 'step-image') {
        if (!(await canEditProject(user, projectId))) return { status: 403, error: '權限不足' }
        return { path: `${projectId}/step-images/${name}` }
    }
    if (purpose === 'step-attachment') {
        if (!(await canEditProject(user, await projectIdOfStep(stepId)))) return { status: 403, error: '權限不足' }
        return { path: `step-attachments/${stepId}/${name}` }
    }
    if (purpose === 'transcript') {
        if (!(await isRoomMember(user.id, roomId))) return { status: 403, error: '只有研究室成員可以上傳逐字稿' }
        return { path: `rooms/${roomId}/uploads/${name}` }
    }
    return { status: 400, error: '不支援的上傳用途' }
}

/**
 * 解析物件路徑屬於哪一類，回傳 { kind, id }；不認得的格式回傳 null。
 */
export function classifyPath(path) {
    if (typeof path !== 'string' || path.includes('..')) return null
    let m = path.match(new RegExp(`^(${UUID_RE})/step-images/[^/]+$`))
    if (m) return { kind: 'step-image', id: m[1] }
    m = path.match(new RegExp(`^step-attachments/(${UUID_RE})/[^/]+$`))
    if (m) return { kind: 'step-attachment', id: m[1] }
    m = path.match(new RegExp(`^rooms/(${UUID_RE})/uploads/[^/]+$`))
    if (m) return { kind: 'transcript', id: m[1] }
    return null
}

/**
 * 能不能讀這個物件（發 signed URL 之前呼叫）。
 */
export async function canReadPath(user, path) {
    const c = classifyPath(path)
    if (!c) {
        // 不認得的路徑（例如舊環境留下來的檔案）只給系統管理員 / 平台管理者
        return ['system_admin', 'platform_manager'].includes(user.role)
    }
    if (c.kind === 'step-image' || c.kind === 'step-attachment') return !!user.perms.manage_modes
    if (c.kind === 'transcript') return canViewRoom(user, c.id)
    return false
}

export async function createSignedReadUrl(path) {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL)
    if (error) throw error
    return data.signedUrl
}

export async function removeObjects(paths) {
    const list = paths.filter(Boolean)
    if (list.length === 0) return
    const { error } = await supabaseAdmin.storage.from(BUCKET).remove(list)
    if (error) console.warn('Storage remove warning:', error.message)
}

/**
 * 把 .txt / .docx / .pdf 轉成純文字。
 */
export async function extractText(buffer, fileName) {
    const ext = fileExtension(fileName)
    if (ext === 'txt') return buffer.toString('utf-8')
    if (ext === 'docx') return (await mammoth.extractRawText({ buffer })).value
    if (ext === 'pdf') return (await pdfParse(buffer)).text
    if (ext === 'doc') throw new Error('不支援 .doc 格式，請將檔案另存為 .docx 格式後再上傳')
    if (ext === 'odt') throw new Error('暫不支援 .odt 格式，請將檔案另存為 .docx 或 .txt 格式')
    throw new Error(`不支援的檔案格式: .${ext}`)
}

export async function downloadObject(path) {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(path)
    if (error) throw new Error('從 Storage 讀取檔案失敗')
    return Buffer.from(await data.arrayBuffer())
}
