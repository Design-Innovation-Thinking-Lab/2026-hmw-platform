/**
 * POST /api/users/change-password
 * User changes their own password. Clears must_change_password flag.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
})

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const { userId, currentPassword, newPassword } = req.body

    if (!userId || !newPassword) {
        return res.status(400).json({ error: '缺少必要參數' })
    }

    if (newPassword.length < 4) {
        return res.status(400).json({ error: '新密碼至少需要 4 個字元' })
    }

    try {
        // Verify current password
        const { data: user, error: userError } = await supabaseAdmin
            .from('users')
            .select('id, name, verification_password')
            .eq('id', userId)
            .single()

        if (userError || !user) {
            return res.status(404).json({ error: '找不到使用者' })
        }

        if (user.verification_password !== currentPassword) {
            return res.status(401).json({ error: '目前密碼不正確' })
        }

        if (newPassword === currentPassword) {
            return res.status(400).json({ error: '新密碼不能與目前密碼相同' })
        }

        // Update password and clear flag
        const { error } = await supabaseAdmin
            .from('users')
            .update({
                verification_password: newPassword,
                must_change_password: false
            })
            .eq('id', userId)

        if (error) throw error

        return res.status(200).json({
            success: true,
            message: '密碼已變更成功'
        })
    } catch (err) {
        console.error('Error changing password:', err)
        return res.status(500).json({ error: err.message })
    }
}
