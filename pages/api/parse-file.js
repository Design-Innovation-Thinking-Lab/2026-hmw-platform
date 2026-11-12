/**
 * /api/parse-file - Parse uploaded file and extract text content
 * Supports: .txt, .docx, .pdf
 */
import formidable from 'formidable'
import fs from 'fs'
import mammoth from 'mammoth'
import pdfParse from 'pdf-parse'

export const config = {
    api: {
        bodyParser: false, // Required for formidable
    },
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        const form = formidable({
            maxFileSize: 10 * 1024 * 1024, // 10MB limit
        })

        const [fields, files] = await form.parse(req)
        const file = files.file?.[0]

        if (!file) {
            return res.status(400).json({ error: '請選擇檔案' })
        }

        const filePath = file.filepath
        const fileName = file.originalFilename || 'unknown'
        const extension = fileName.split('.').pop()?.toLowerCase()

        let extractedText = ''

        switch (extension) {
            case 'txt':
                extractedText = fs.readFileSync(filePath, 'utf-8')
                break

            case 'docx':
                const docxResult = await mammoth.extractRawText({ path: filePath })
                extractedText = docxResult.value
                break

            case 'pdf':
                const pdfBuffer = fs.readFileSync(filePath)
                const pdfResult = await pdfParse(pdfBuffer)
                extractedText = pdfResult.text
                break

            case 'doc':
                return res.status(400).json({
                    error: '不支援 .doc 格式，請將檔案另存為 .docx 格式後再上傳'
                })

            case 'odt':
                return res.status(400).json({
                    error: '暫不支援 .odt 格式，請將檔案另存為 .docx 或 .txt 格式'
                })

            default:
                return res.status(400).json({
                    error: `不支援的檔案格式: .${extension}`
                })
        }

        // Clean up temp file
        fs.unlinkSync(filePath)

        res.status(200).json({
            success: true,
            text: extractedText,
            fileName: fileName.replace(/\.[^/.]+$/, '') // Remove extension
        })

    } catch (error) {
        console.error('File parsing error:', error)
        res.status(500).json({ error: '檔案解析失敗: ' + error.message })
    }
}
