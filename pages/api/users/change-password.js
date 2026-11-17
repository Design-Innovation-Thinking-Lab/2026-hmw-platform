/**
 * POST /api/users/change-password
 * 使用者變更自己的密碼，並清除 must_change_password。
 * 需要 Authorization: Bearer <Supabase access_token>；
 * 是誰由伺服器向 Supabase 驗證，不相信前端送來的 userId。
 */
import { supabaseAdmin, getAuthUser, checkPassword } from '../../../lib/serverAuth'
import { MIN_PASSWORD_LENGTH } from '../../../lib/password'

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const authUser = await getAuthUser(req)
    if (!authUser) {
        return res.status(401).json({ error: '登入已失效，請重新登入' })
    }

    const { currentPassword, newPassword } = req.body || {}

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: '缺少必要參數' })
    }

    if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ error: `新密碼至少需要 ${MIN_PASSWORD_LENGTH} 個字元` })
    }

    if (newPassword === currentPassword) {
        return res.status(400).json({ error: '新密碼不能與目前密碼相同' })
    }

    try {
        // 向 Supabase Auth 確認目前密碼
        const ok = await checkPassword(authUser.email, currentPassword)
        if (!ok) {
            return res.status(401).json({ error: '目前密碼不正確' })
        }

        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
            password: newPassword
        })
        if (authError) {
            console.error('Error updating auth password:', authError)
            if (authError.code === 'weak_password') {
                return res.status(400).json({ error: '新密碼不符合規則，請換一組更長或更複雜的密碼' })
            }
            return res.status(500).json({ error: '變更密碼失敗，請稍後再試' })
        }

        const { error } = await supabaseAdmin
            .from('users')
            .update({ must_change_password: false })
            .eq('id', authUser.id)

        if (error) throw error

        return res.status(200).json({
            success: true,
            message: '密碼已變更成功'
        })
    } catch (err) {
        console.error('Error changing password:', err)
        return res.status(500).json({ error: '變更密碼失敗，請稍後再試' })
    }
}
