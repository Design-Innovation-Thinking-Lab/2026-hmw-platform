// 伺服器端專用：確認請求是哪個已登入的使用者發的。
// 只能在 pages/api/ 或 lib/ 的伺服器端程式使用（用到 service role key）。
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
})

// 從 Authorization: Bearer <access_token> 取出 Supabase 的登入憑證
export function getBearerToken(req) {
    const header = req.headers?.authorization || ''
    const match = header.match(/^Bearer\s+(.+)$/i)
    return match ? match[1].trim() : null
}

// 把憑證交給 Supabase Auth 驗證；通過才回傳使用者（id、email），否則回傳 null。
// 不相信前端送來的 userId。
export async function getAuthUser(req) {
    const token = getBearerToken(req)
    if (!token) return null
    const { data, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !data?.user) return null
    return data.user
}

// 用 email＋密碼向 Supabase Auth 確認密碼是否正確（例如改密碼前確認目前密碼）。
// 用一個不保存登入狀態的 anon client，不會影響 service role client。
export async function checkPassword(email, password) {
    if (!email || !password) return false
    const client = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    })
    const { data, error } = await client.auth.signInWithPassword({ email, password })
    if (error || !data?.user) return false
    // 只是確認密碼，用完就登出這次產生的 session。
    // scope 'local' 只登出這一個 session；預設的 'global' 會把使用者在瀏覽器上的登入也登出。
    await client.auth.signOut({ scope: 'local' }).catch(() => {})
    return true
}
