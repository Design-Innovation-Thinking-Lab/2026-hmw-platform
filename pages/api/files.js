import { requireUser, supabaseAdmin, canEditProject } from '../../lib/auth'

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'uploads'

export default async function handler(req, res) {
  if (req. method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // 舊流程（以 project 為單位上傳檔案）：只有能編輯該分析模式的後台使用者可以用
  const user = await requireUser(req, res, { permission: 'manage_modes' })
  if (!user) return

  const { path, projectId, filename, contentType } = req.body
  const bucket = BUCKET // 不接受前端指定 bucket

  if (!path || !projectId || !filename) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  if (!(await canEditProject(user, projectId))) {
    return res.status(403).json({ error: '權限不足' })
  }

  try {
    // 1. 在 files 表建立記錄
    const { data: fileRecord, error: insertError } = await supabaseAdmin
      .from('files')
      .insert({
        project_id: projectId,
        filename: filename,
        storage_path: path,
        content_type: contentType,
        status: 'pending'
      })
      .select()
      .single()

    if (insertError) {
      console.error('Insert file error:', insertError)
      return res. status(500).json({ error: insertError.message })
    }

    // 2. 從 Storage 下載檔案內容
    const { data: fileData, error: downloadError } = await supabaseAdmin
      .storage
      .from(bucket)
      .download(path)

    if (downloadError) {
      console.error('Download error:', downloadError)
      return res.status(500).json({ error: downloadError. message })
    }

    // 3. 讀取文字內容
    const text = await fileData.text()

    // 4.  簡單解析（按段落分割）
    const paragraphs = text
      .split(/\n\n+/)
      . map(p => p.trim())
      .filter(p => p.length > 0)

    // 5.  插入 transcripts 表
    const transcriptsToInsert = paragraphs.map((content, index) => ({
      project_id: projectId,
      file_id: fileRecord. id,
      speaker: 'Unknown',
      content: content,
      sequence: index + 1
    }))

    const { error: transcriptError } = await supabaseAdmin
      .from('transcripts')
      .insert(transcriptsToInsert)

    if (transcriptError) {
      console.error('Insert transcripts error:', transcriptError)
      return res.status(500).json({ error: transcriptError.message })
    }

    // 6. 更新 file 狀態為 parsed
    await supabaseAdmin
      .from('files')
      .update({ status: 'parsed' })
      . eq('id', fileRecord.id)

    return res.status(200).json({ 
      success: true, 
      fileId: fileRecord. id,
      inserted: transcriptsToInsert.length 
    })

  } catch (err) {
    console.error('Server error:', err)
    return res.status(500).json({ error: err.message })
  }
}