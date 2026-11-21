/**
 * POST /api/storage/upload-url
 * 檢查權限後發一個 signed upload URL，瀏覽器再用 supabase.storage.uploadToSignedUrl
 * 直接把檔案傳到私人 bucket（不經過 Vercel API，沒有 4.5 MB 限制）。
 *
 * body: { purpose: 'step-image' | 'step-attachment' | 'transcript',
 *         projectId? , stepId? , roomId? , fileName, size }
 * 回傳: { bucket, path, token }
 */
import { requireUser, supabaseAdmin } from '../../../lib/auth'
import { BUCKET, planUpload } from '../../../lib/storage'

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const user = await requireUser(req, res)
    if (!user) return

    try {
        const plan = await planUpload(user, req.body || {})
        if (plan.error) return res.status(plan.status).json({ error: plan.error })

        const { data, error } = await supabaseAdmin.storage
            .from(BUCKET)
            .createSignedUploadUrl(plan.path)
        if (error) throw error

        return res.status(200).json({ bucket: BUCKET, path: data.path, token: data.token })
    } catch (err) {
        console.error('Error creating signed upload URL:', err)
        return res.status(500).json({ error: '無法建立上傳網址' })
    }
}
