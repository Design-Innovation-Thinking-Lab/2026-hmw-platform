/**
 * /api/analysis/quota - Check user's daily analysis quota status
 *
 * GET（查詢目前登入者自己的額度，是誰由登入憑證判斷）
 * Returns: { dailyQuota, usedToday, remaining }
 */
import { supabaseAdmin, requireUser } from '../../../lib/serverAuth'

/**
 * Get the start of today in Asia/Taipei timezone as ISO string
 */
function getTodayStartTaipei() {
    const now = new Date()
    const taipeiDate = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
    // taipeiDate is "YYYY-MM-DD" in Taipei timezone
    // Convert back to UTC for DB query
    return new Date(taipeiDate + 'T00:00:00+08:00').toISOString()
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const authed = await requireUser(req, res)
    if (!authed) return
    const userId = authed.id

    try {
        // Fetch user's quota setting
        const { data: user, error: userError } = await supabaseAdmin
            .from('users')
            .select('daily_analysis_quota, role')
            .eq('id', userId)
            .single()

        if (userError || !user) {
            return res.status(404).json({ error: '找不到該使用者' })
        }

        // Admins have unlimited quota
        if (user.role === 'system_admin') {
            return res.status(200).json({
                dailyQuota: null, // null means unlimited
                usedToday: 0,
                remaining: null,
                unlimited: true
            })
        }

        const dailyQuota = user.daily_analysis_quota ?? 3 // Default to 3 if null

        // Count today's analysis runs for this user
        const todayStart = getTodayStartTaipei()

        const { count, error: countError } = await supabaseAdmin
            .from('analysis_runs')
            .select('*', { count: 'exact', head: true })
            .eq('initiator_id', userId)
            .gte('created_at', todayStart)

        if (countError) throw countError

        const usedToday = count || 0
        const remaining = Math.max(0, dailyQuota - usedToday)

        return res.status(200).json({
            dailyQuota,
            usedToday,
            remaining,
            unlimited: false
        })
    } catch (err) {
        console.error('Error checking quota:', err)
        return res.status(500).json({ error: err.message })
    }
}
