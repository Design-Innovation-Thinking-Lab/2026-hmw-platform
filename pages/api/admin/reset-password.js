/**
 * POST /api/admin/reset-password
 * Admin resets a user's password to a random temporary password (Supabase Auth).
 * The temporary password is returned once so the admin can hand it to the user.
 * Sets must_change_password = true so user is forced to change on next login.
 * 管理員身分由登入憑證判斷（lib/serverAuth），不讀前端送來的 adminId。
 */
import { supabaseAdmin, requireAdmin } from '../../../lib/serverAuth'
import { generateTempPassword } from '../../../lib/tempPassword'

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const admin = await requireAdmin(req, res)
    if (!admin) return

    const { userId } = req.body

    if (!userId) {
        return res.status(400).json({ error: 'userId is required' })
    }

    try {

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

        // 在 Supabase Auth 設定隨機臨時密碼（users.id 和 Auth 帳號 id 相同）
        const tempPassword = generateTempPassword()
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password: tempPassword
        })
        if (authError) {
            console.error('Error resetting auth password:', authError)
            if (authError.code === 'user_not_found' || authError.status === 404) {
                return res.status(404).json({ error: '這個帳號是改用 Supabase Auth 之前建立的，沒有登入帳號，請使用者重新註冊' })
            }
            return res.status(500).json({ error: '重設密碼失敗，請稍後再試' })
        }

        const { error } = await supabaseAdmin
            .from('users')
            .update({ must_change_password: true })
            .eq('id', userId)

        if (error) throw error

        return res.status(200).json({
            message: `已重設「${target.name}」的密碼，該使用者下次登入時須自行變更密碼。`,
            // 只回傳這一次，伺服器不保存
            tempPassword
        })
    } catch (err) {
        console.error('Error resetting password:', err)
        return res.status(500).json({ error: '重設密碼失敗，請稍後再試' })
    }
}
