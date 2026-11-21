/**
 * POST /api/admin/reset-password
 * 管理員替使用者寄出「重設密碼」信（Supabase Auth）。
 * 不再把密碼改成固定的預設值；使用者點信裡的連結到 /reset-password 自己設新密碼。
 * 只有 system_admin / platform_manager 可以使用；platform_manager 不能對 system_admin 使用。
 */
import { requireUser, supabaseAdmin } from '../../../lib/auth'

function siteOrigin(req) {
    if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '')
    const proto = req.headers['x-forwarded-proto'] || 'https'
    return `${proto}://${req.headers.host}`
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const admin = await requireUser(req, res, { roles: ['system_admin', 'platform_manager'] })
    if (!admin) return

    const { userId } = req.body || {}
    if (!userId) {
        return res.status(400).json({ error: 'userId is required' })
    }

    try {
        const { data: target } = await supabaseAdmin
            .from('users')
            .select('name, role, email')
            .eq('id', userId)
            .maybeSingle()

        if (!target) {
            return res.status(404).json({ error: '找不到該使用者' })
        }

        if (target.role === 'system_admin' && admin.role !== 'system_admin') {
            return res.status(403).json({ error: '無法重設系統管理員的密碼' })
        }

        if (!target.email) {
            return res.status(400).json({ error: '這個使用者沒有 Email，無法寄送重設密碼信' })
        }

        const { error } = await supabaseAdmin.auth.resetPasswordForEmail(target.email, {
            redirectTo: `${siteOrigin(req)}/reset-password`,
        })
        if (error) throw error

        return res.status(200).json({
            message: `已寄出重設密碼信給「${target.name}」，請對方到信箱點連結設定新密碼。`
        })
    } catch (err) {
        console.error('Error sending reset email:', err)
        return res.status(500).json({ error: '寄送重設密碼信失敗' })
    }
}
