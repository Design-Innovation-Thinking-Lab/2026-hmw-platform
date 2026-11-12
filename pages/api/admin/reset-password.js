/**
 * POST /api/admin/reset-password
 * Admin resets a user's password to a default value.
 * Sets must_change_password = true so user is forced to change on next login.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
})

const DEFAULT_PASSWORD = '0000'

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const { adminId, userId } = req.body

    if (!adminId || !userId) {
        return res.status(400).json({ error: 'adminId and userId are required' })
    }

    try {
        // Verify requester has permission
        const { data: admin } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('id', adminId)
            .single()

        if (!['system_admin', 'platform_manager'].includes(admin?.role)) {
            return res.status(403).json({ error: '權限不足：只有系統管理員或平台管理者可以重設密碼' })
        }

        // Get target user info
        const { data: target } = await supabaseAdmin
            .from('users')
            .select('name, role')
            .eq('id', userId)
            .single()

        if (!target) {
            return res.status(404).json({ error: '找不到該使用者' })
        }

        // Cannot reset system_admin password (unless you are system_admin)
        if (target.role === 'system_admin' && admin?.role !== 'system_admin') {
            return res.status(403).json({ error: '無法重設系統管理員的密碼' })
        }

        // Reset password and set flag
        const { error } = await supabaseAdmin
            .from('users')
            .update({
                verification_password: DEFAULT_PASSWORD,
                must_change_password: true
            })
            .eq('id', userId)

        if (error) throw error

        return res.status(200).json({
            message: `已將「${target.name}」的密碼重設為預設密碼（${DEFAULT_PASSWORD}），該使用者下次登入時須自行變更密碼。`
        })
    } catch (err) {
        console.error('Error resetting password:', err)
        return res.status(500).json({ error: err.message })
    }
}
