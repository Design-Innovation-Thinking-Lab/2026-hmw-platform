/**
 * /api/analysis/quota - Check user's daily analysis quota status
 *
 * GET（查詢目前登入者自己的額度）
 * Returns: { dailyQuota, usedToday, remaining }
 */
import { requireUser, getQuotaStatus } from '../../../lib/auth'

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const user = await requireUser(req, res)
    if (!user) return

    try {
        return res.status(200).json(await getQuotaStatus(user))
    } catch (err) {
        console.error('Error checking quota:', err)
        return res.status(500).json({ error: '查詢額度失敗' })
    }
}
