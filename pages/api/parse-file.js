/**
 * /api/parse-file - Parse uploaded file and extract text content
 * Supports: .txt, .docx, .pdf
 *
 * 只處理小檔（Vercel 的 API 一次最多收 4.5 MB）。
 * 更大的檔案由前端改用 signed upload URL 直接傳到 Storage，
 * 再呼叫 POST /api/transcripts（帶 storage_path）由伺服器解析。
 */
import formidable from 'formidable'
import fs from 'fs'
import { requireUser } from '../../lib/auth'
import { extractText } from '../../lib/storage'

export const config = {
    api: {
        bodyParser: false, // Required for formidable
    },
}

// 留一點空間給 multipart 的其他內容
const MAX_DIRECT_UPLOAD_BYTES = 4 * 1024 * 1024

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const user = await requireUser(req, res)
    if (!user) return

    let filePath = null
    try {
        const form = formidable({ maxFileSize: MAX_DIRECT_UPLOAD_BYTES })

        const [, files] = await form.parse(req)
        const file = files.file?.[0]

        if (!file) {
            return res.status(400).json({ error: '請選擇檔案' })
        }

        filePath = file.filepath
        const fileName = file.originalFilename || 'unknown'

        let extractedText
        try {
            extractedText = await extractText(fs.readFileSync(filePath), fileName)
        } catch (err) {
            return res.status(400).json({ error: err.message })
        }

        res.status(200).json({
            success: true,
            text: extractedText,
            fileName: fileName.replace(/\.[^/.]+$/, '') // Remove extension
        })
    } catch (error) {
        console.error('File parsing error:', error)
        res.status(500).json({ error: '檔案解析失敗' })
    } finally {
        if (filePath) fs.promises.unlink(filePath).catch(() => {})
    }
}
