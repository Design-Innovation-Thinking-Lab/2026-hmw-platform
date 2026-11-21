/**
 * GET /api/storage/signed-url?path=<物件路徑>
 * 檢查權限後回傳短時間有效的讀取網址（bucket 是私人的，不能用 getPublicUrl）。
 */
import { requireUser } from '../../../lib/auth'
import { canReadPath, createSignedReadUrl, SIGNED_URL_TTL } from '../../../lib/storage'

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const user = await requireUser(req, res)
    if (!user) return

    const { path } = req.query
    if (!path || typeof path !== 'string') {
        return res.status(400).json({ error: 'Missing path' })
    }

    if (!(await canReadPath(user, path))) {
        return res.status(403).json({ error: '權限不足' })
    }

    try {
        const url = await createSignedReadUrl(path)
        return res.status(200).json({ url, expiresIn: SIGNED_URL_TTL })
    } catch (err) {
        console.error('Error creating signed URL:', err)
        return res.status(404).json({ error: '找不到檔案' })
    }
}
