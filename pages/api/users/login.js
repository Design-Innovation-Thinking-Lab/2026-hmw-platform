/**
 * POST /api/users/login
 * 前端先用 Supabase Auth 登入（email＋密碼），再帶著 Supabase 的登入憑證呼叫這支 API：
 *   Authorization: Bearer <access_token>
 * 伺服器向 Supabase 驗證憑證，確認是誰之後才回傳這個人的基本資料。
 * 這支 API 不收、也不比對密碼。
 */
import { supabaseAdmin, getAuthUser } from '../../../lib/serverAuth'

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        const authUser = await getAuthUser(req)
        if (!authUser) {
            return res.status(401).json({ error: '登入已失效，請重新登入' })
        }

        const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('id, name, occupation, is_admin, must_change_password')
            .eq('id', authUser.id)
            .maybeSingle()

        if (error) throw error
        if (!user) {
            return res.status(404).json({ error: '找不到這個帳號的使用者資料，請洽管理員' })
        }

        // 不回傳敏感資訊
        const safeUser = {
            id: user.id,
            name: user.name,
            occupation: user.occupation,
            is_admin: user.is_admin || false,
            must_change_password: user.must_change_password || false
        }

        return res.status(200).json({ success: true, user: safeUser })
    } catch (err) {
        console.error('Login error:', err)
        return res.status(500).json({ error: '登入失敗，請稍後再試' })
    }
}
