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

// ───────────────────────── 權限檢查（第 2 項） ─────────────────────────
// 每支 API 都用下面的函式從登入憑證判斷是誰、能做什麼，
// 不讀前端送來的 userId、adminId、userRole、initiatorId、uploader_id。

const ADMIN_ROLES = ['system_admin', 'platform_manager']

export function isAdminRole(role) {
    return ADMIN_ROLES.includes(role)
}

// 和 pages/api/users/me.js 原本的規則相同：
// system_admin、platform_manager 有全部後台功能；backend_user 依 users.permissions 逐項開啟。
export function getEffectivePermissions(user) {
    const role = user?.role || 'user'
    const permissions = user?.permissions || {}
    const isAdmin = isAdminRole(role)
    const isBackendUser = role === 'backend_user'
    return {
        manage_modes: isAdmin || (isBackendUser && !!permissions.manage_modes),
        manage_roles: isAdmin || (isBackendUser && !!permissions.manage_roles),
        view_results: isAdmin || (isBackendUser && !!permissions.view_results),
        manage_users: isAdmin || (isBackendUser && !!permissions.manage_users),
    }
}

// 確認已登入，並從 users 表讀出這個人的資料。
// 失敗時已經回應 401／403／500，呼叫的 API 直接 return 即可。
export async function requireUser(req, res) {
    const authUser = await getAuthUser(req)
    if (!authUser) {
        res.status(401).json({ error: '請先登入' })
        return null
    }
    const { data: user, error } = await supabaseAdmin
        .from('users')
        .select('id, name, email, role, permissions, daily_analysis_quota')
        .eq('id', authUser.id)
        .maybeSingle()
    if (error) {
        console.error('Error loading user:', error)
        res.status(500).json({ error: '讀取使用者資料失敗' })
        return null
    }
    if (!user) {
        res.status(403).json({ error: '找不到這個帳號的使用者資料' })
        return null
    }
    return { ...user, role: user.role || 'user', permissions: user.permissions || {} }
}

// 只有 system_admin、platform_manager 可以呼叫
export async function requireAdmin(req, res) {
    const user = await requireUser(req, res)
    if (!user) return null
    if (!isAdminRole(user.role)) {
        res.status(403).json({ error: '權限不足' })
        return null
    }
    return user
}

// 需要某一項後台權限（manage_modes、manage_roles、view_results、manage_users）
export async function requirePermission(req, res, permission) {
    const user = await requireUser(req, res)
    if (!user) return null
    if (!getEffectivePermissions(user)[permission]) {
        res.status(403).json({ error: '權限不足' })
        return null
    }
    return user
}

export async function isRoomMember(roomId, userId) {
    if (!roomId || !userId) return false
    const { data, error } = await supabaseAdmin
        .from('room_members')
        .select('id')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .maybeSingle()
    if (error) {
        console.error('Error checking room membership:', error)
        return false
    }
    return !!data
}

// 確認是這個房間的成員；不是的話回應 403 並回傳 false。
export async function requireRoomMember(res, user, roomId) {
    if (!roomId) {
        res.status(400).json({ error: 'Missing roomId' })
        return false
    }
    if (!(await isRoomMember(roomId, user.id))) {
        res.status(403).json({ error: '你不是這個房間的成員' })
        return false
    }
    return true
}

// 能不能修改這個分析模式（projects）的設定：
// 管理員可以改全部；有 manage_modes 的 backend_user 只能改自己建立的（owner_id）。
// 規則和 pages/api/projects.js 原本的 PUT、DELETE 相同。
export async function canEditProject(user, projectId) {
    if (!projectId) return false
    if (isAdminRole(user.role)) return true
    if (!getEffectivePermissions(user).manage_modes) return false
    const { data: project } = await supabaseAdmin
        .from('projects')
        .select('owner_id')
        .eq('id', projectId)
        .maybeSingle()
    return !!project && project.owner_id === user.id
}
