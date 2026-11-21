/**
 * lib/auth.js — 伺服器端身分驗證（只能在 pages/api/*、server/* 使用）
 *
 * 前端用 Supabase Auth 登入後，每個 API 請求都會帶
 *   Authorization: Bearer <access_token>
 * （見 lib/apiFetch.js）。這裡用 service role 向 Supabase 驗證 token，
 * 再從 public.users 讀出角色與權限。前端送來的 userId / userRole 一律不採信。
 */
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
)

const USER_COLUMNS = 'id, name, email, student_id, occupation, role, permissions, daily_analysis_quota, created_at'

/**
 * 根據角色與 permissions 欄位算出實際權限。
 * system_admin / platform_manager：全部後台功能；backend_user：依 permissions；user：無後台權限。
 * manage_users（後台「權限管理」頁）維持原本的規則：只有 system_admin。
 * （/api/admin/users 的各項操作另外依角色檢查，platform_manager 可管理 backend_user / user。）
 */
export function effectivePermissions(user) {
    const role = user?.role || 'user'
    const perms = user?.permissions || {}
    const full = role === 'system_admin' || role === 'platform_manager'
    const backend = role === 'backend_user'
    return {
        manage_modes: full || (backend && !!perms.manage_modes),
        manage_roles: full || (backend && !!perms.manage_roles),
        view_results: full || (backend && !!perms.view_results),
        manage_users: role === 'system_admin',
    }
}

export function hasBackendAccess(user) {
    return ['system_admin', 'platform_manager', 'backend_user'].includes(user?.role)
}

export function isAdmin(user) {
    return ['system_admin', 'platform_manager'].includes(user?.role)
}

function getBearerToken(req) {
    const header = req.headers.authorization || ''
    const match = header.match(/^Bearer\s+(.+)$/i)
    return match ? match[1].trim() : null
}

/**
 * 回傳目前登入的使用者（public.users 的資料 + perms），沒登入或 token 無效回傳 null。
 */
export async function getSessionUser(req) {
    const token = getBearerToken(req)
    if (!token) return null

    const { data, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !data?.user) return null

    const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select(USER_COLUMNS)
        .eq('id', data.user.id)
        .maybeSingle()

    if (userError || !user) return null

    return {
        ...user,
        role: user.role || 'user',
        permissions: user.permissions || {},
        perms: effectivePermissions(user),
    }
}

/**
 * 在 handler 開頭呼叫：
 *   const user = await requireUser(req, res)
 *   if (!user) return
 *
 * options.permission：需要的後台權限（manage_modes / manage_roles / view_results / manage_users）
 * options.roles：只允許這些角色
 * options.backend：需要任一後台權限（system_admin / platform_manager / backend_user）
 * options.profile：需要已填完個人資料（預設 false）
 *
 * 驗證失敗時已經回應 401 / 403，呼叫端直接 return 即可。
 */
export async function requireUser(req, res, options = {}) {
    let user
    try {
        user = await getSessionUser(req)
    } catch (err) {
        console.error('Auth check failed:', err)
        res.status(500).json({ error: '身分驗證失敗' })
        return null
    }

    if (!user) {
        res.status(401).json({ error: '請先登入', code: 'UNAUTHENTICATED' })
        return null
    }

    if (options.roles && !options.roles.includes(user.role)) {
        res.status(403).json({ error: '權限不足' })
        return null
    }

    if (options.backend && !hasBackendAccess(user)) {
        res.status(403).json({ error: '權限不足：需要後台權限' })
        return null
    }

    if (options.permission && !user.perms[options.permission]) {
        res.status(403).json({ error: '權限不足' })
        return null
    }

    if (options.profile && !user.occupation) {
        res.status(403).json({ error: '請先完成個人資料', code: 'PROFILE_INCOMPLETE' })
        return null
    }

    return user
}

/**
 * 是否為研究室成員（room_members 有資料）。
 */
export async function isRoomMember(userId, roomId) {
    if (!userId || !roomId) return false
    const { data } = await supabaseAdmin
        .from('room_members')
        .select('id')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .maybeSingle()
    return !!data
}

/**
 * 可以讀取研究室內容：成員，或有 view_results 權限的後台使用者。
 */
export async function canViewRoom(user, roomId) {
    if (user?.perms?.view_results) return true
    return isRoomMember(user?.id, roomId)
}

/**
 * 可以編輯分析模式（project）：system_admin / platform_manager 全部；
 * 有 manage_modes 的 backend_user 只能編輯自己擁有的。
 */
export async function canEditProject(user, projectId) {
    if (!projectId) return false
    if (isAdmin(user)) return true
    if (user?.role !== 'backend_user' || !user.perms.manage_modes) return false
    const { data } = await supabaseAdmin
        .from('projects')
        .select('owner_id')
        .eq('id', projectId)
        .maybeSingle()
    return !!data && data.owner_id === user.id
}

/**
 * 找出分析步驟所屬的 project_id。
 */
export async function projectIdOfStep(stepId) {
    if (!stepId) return null
    const { data } = await supabaseAdmin
        .from('analysis_flow_steps')
        .select('project_id')
        .eq('id', stepId)
        .maybeSingle()
    return data?.project_id || null
}

/**
 * 今天（台北時間）的開始，ISO 字串。
 */
export function getTodayStartTaipei() {
    const taipeiDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
    return new Date(taipeiDate + 'T00:00:00+08:00').toISOString()
}

/**
 * 每日分析額度。system_admin 不限。
 */
export async function getQuotaStatus(user) {
    if (user.role === 'system_admin') {
        return { dailyQuota: null, usedToday: 0, remaining: null, unlimited: true }
    }
    const dailyQuota = user.daily_analysis_quota ?? 3
    const { count, error } = await supabaseAdmin
        .from('analysis_runs')
        .select('*', { count: 'exact', head: true })
        .eq('initiator_id', user.id)
        .gte('created_at', getTodayStartTaipei())
    if (error) throw error
    const usedToday = count || 0
    return { dailyQuota, usedToday, remaining: Math.max(0, dailyQuota - usedToday), unlimited: false }
}
