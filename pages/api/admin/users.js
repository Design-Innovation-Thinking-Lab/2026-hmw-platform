/**
 * /api/admin/users - Admin user management API
 * Supports 4-tier role system: system_admin, platform_manager, backend_user, user
 * With per-feature permission control for backend_user
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
})

const VALID_ROLES = ['system_admin', 'platform_manager', 'backend_user', 'user']
const VALID_PERMISSIONS = ['manage_modes', 'manage_roles', 'view_results', 'manage_users']

const ROLE_NAMES = {
    system_admin: '系統管理員',
    platform_manager: '平台管理者',
    backend_user: '後台使用者',
    user: '前台使用者'
}

/**
 * Check if requester has authority to manage target role.
 * system_admin can manage all roles.
 * platform_manager can manage backend_user and user.
 */
function canManageRole(requesterRole, targetRole) {
    if (requesterRole === 'system_admin') return true
    if (requesterRole === 'platform_manager') {
        return ['backend_user', 'user'].includes(targetRole)
    }
    return false
}

/**
 * Check if requester can assign a specific role.
 * system_admin can assign any role except system_admin to others.
 * platform_manager can only assign backend_user and user.
 */
function canAssignRole(requesterRole, newRole) {
    if (requesterRole === 'system_admin') return VALID_ROLES.includes(newRole)
    if (requesterRole === 'platform_manager') {
        return ['backend_user', 'user'].includes(newRole)
    }
    return false
}

export default async function handler(req, res) {
    const { method } = req

    // GET: List all users with full details
    if (method === 'GET') {
        const { includeUsage } = req.query

        try {
            const { data: users, error } = await supabaseAdmin
                .from('users')
                .select('id, name, email, student_id, role, occupation, age, school, department, major, grade, industry, position, highest_education_school, highest_education_department, highest_education_major, highest_education_grade, permissions, daily_analysis_quota, created_at')
                .order('created_at', { ascending: false })

            if (error) throw error

            let result = users.map(user => ({
                ...user,
                daily_analysis_quota: user.daily_analysis_quota ?? 3,
                permissions: user.permissions || {},
                is_admin: user.role === 'system_admin' // backward compat
            }))

            // Optionally include today's usage count
            if (includeUsage === 'true') {
                const now = new Date()
                const taipeiDate = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
                const todayStart = new Date(taipeiDate + 'T00:00:00+08:00').toISOString()

                const { data: todayRuns, error: runsError } = await supabaseAdmin
                    .from('analysis_runs')
                    .select('initiator_id')
                    .gte('created_at', todayStart)

                if (!runsError && todayRuns) {
                    const usageCounts = {}
                    todayRuns.forEach(run => {
                        if (run.initiator_id) {
                            usageCounts[run.initiator_id] = (usageCounts[run.initiator_id] || 0) + 1
                        }
                    })
                    result = result.map(user => ({
                        ...user,
                        used_today: usageCounts[user.id] || 0
                    }))
                }
            }

            return res.status(200).json({ users: result })
        } catch (err) {
            console.error('Error fetching users:', err)
            return res.status(500).json({ error: err.message })
        }
    }

    // PUT: Update user role
    if (method === 'PUT') {
        const { adminId, userId, newRole } = req.body

        if (!adminId || !userId || !newRole) {
            return res.status(400).json({ error: 'adminId, userId, and newRole are required' })
        }

        if (!VALID_ROLES.includes(newRole)) {
            return res.status(400).json({ error: `無效角色。可選：${VALID_ROLES.join(', ')}` })
        }

        try {
            const { data: admin } = await supabaseAdmin
                .from('users').select('role').eq('id', adminId).single()

            if (!canAssignRole(admin?.role, newRole)) {
                return res.status(403).json({ error: '權限不足：您無法指派此角色' })
            }

            // Check current role of target user
            const { data: target } = await supabaseAdmin
                .from('users').select('role, name').eq('id', userId).single()

            if (!target) {
                return res.status(404).json({ error: '找不到該使用者' })
            }

            // Prevent self-demotion for system_admin
            if (userId === adminId && admin?.role === 'system_admin' && newRole !== 'system_admin') {
                return res.status(400).json({ error: '無法降低自己的系統管理員權限' })
            }

            // platform_manager cannot change users above their level
            if (!canManageRole(admin?.role, target.role) && userId !== adminId) {
                return res.status(403).json({ error: '權限不足：無法管理此使用者的角色' })
            }

            // When changing to backend_user, set default empty permissions
            const updateData = { role: newRole }
            if (newRole === 'backend_user' && target.role !== 'backend_user') {
                updateData.permissions = {}
            }
            // When changing away from backend_user, clear permissions
            if (newRole !== 'backend_user') {
                updateData.permissions = {}
            }

            const { data: user, error } = await supabaseAdmin
                .from('users')
                .update(updateData)
                .eq('id', userId)
                .select('id, name, role, permissions')
                .single()

            if (error) throw error

            return res.status(200).json({
                user,
                message: `已將「${user.name}」的角色更新為「${ROLE_NAMES[newRole]}」`
            })
        } catch (err) {
            console.error('Error updating user role:', err)
            return res.status(500).json({ error: err.message })
        }
    }

    // PATCH: Update user permissions or daily quota
    if (method === 'PATCH') {
        const { adminId, userId, permissions, dailyAnalysisQuota } = req.body

        if (!adminId || !userId) {
            return res.status(400).json({ error: 'adminId and userId are required' })
        }

        try {
            const { data: admin } = await supabaseAdmin
                .from('users').select('role').eq('id', adminId).single()

            if (!['system_admin', 'platform_manager'].includes(admin?.role)) {
                return res.status(403).json({ error: '權限不足' })
            }

            // Fetch target user's current permissions for comparison
            const { data: targetUser, error: targetError } = await supabaseAdmin
                .from('users').select('role, permissions').eq('id', userId).single()

            if (targetError || !targetUser) {
                return res.status(404).json({ error: '找不到該使用者' })
            }

            // platform_manager can only manage backend_user and user
            if (admin?.role === 'platform_manager' && !['backend_user', 'user'].includes(targetUser.role)) {
                return res.status(403).json({ error: '權限不足：無法管理此使用者' })
            }

            const updateData = {}

            // Update permissions (for backend_user)
            if (permissions !== undefined) {
                const currentPerms = targetUser.permissions || {}

                // Validate permission keys
                const cleanPerms = {}
                for (const key of VALID_PERMISSIONS) {
                    if (key in permissions) {
                        cleanPerms[key] = !!permissions[key]
                    }
                }

                // platform_manager cannot newly grant manage_users
                // (but can preserve existing manage_users value)
                if (admin?.role === 'platform_manager') {
                    if (cleanPerms.manage_users && !currentPerms.manage_users) {
                        return res.status(403).json({ error: '平台管理者無法授予權限管理功能' })
                    }
                    // Also prevent platform_manager from revoking manage_users set by system_admin
                    if ('manage_users' in cleanPerms && currentPerms.manage_users) {
                        cleanPerms.manage_users = true // preserve system_admin's setting
                    }
                }

                updateData.permissions = cleanPerms
            }

            // Update daily quota
            if (dailyAnalysisQuota !== undefined) {
                const quota = parseInt(dailyAnalysisQuota)
                if (isNaN(quota) || quota < 0 || quota > 999) {
                    return res.status(400).json({ error: '每日額度必須是 0-999 之間的數字' })
                }
                updateData.daily_analysis_quota = quota
            }

            if (Object.keys(updateData).length === 0) {
                return res.status(400).json({ error: '未提供要更新的資料' })
            }

            const { data: user, error } = await supabaseAdmin
                .from('users')
                .update(updateData)
                .eq('id', userId)
                .select('id, name, permissions, daily_analysis_quota')
                .single()

            if (error) throw error

            return res.status(200).json({
                user,
                message: `已更新「${user.name}」的設定`
            })
        } catch (err) {
            console.error('Error updating user settings:', err)
            return res.status(500).json({ error: err.message })
        }
    }

    // POST: Check user permissions
    if (method === 'POST') {
        const { userId } = req.body

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' })
        }

        try {
            const { data: user, error } = await supabaseAdmin
                .from('users')
                .select('id, name, role, permissions')
                .eq('id', userId)
                .single()

            if (error) throw error

            const role = user?.role || 'user'
            const isSystemAdmin = role === 'system_admin'
            const isPlatformManager = role === 'platform_manager'
            const isBackendUser = role === 'backend_user'
            const permissions = user?.permissions || {}

            return res.status(200).json({
                hasAdminAccess: isSystemAdmin || isPlatformManager || isBackendUser,
                isAdmin: isSystemAdmin,
                isPlatformManager,
                isBackendUser,
                role,
                userName: user?.name,
                permissions: {
                    manage_modes: isSystemAdmin || isPlatformManager || (isBackendUser && !!permissions.manage_modes),
                    manage_roles: isSystemAdmin || isPlatformManager || (isBackendUser && !!permissions.manage_roles),
                    view_results: isSystemAdmin || isPlatformManager || (isBackendUser && !!permissions.view_results),
                    manage_users: isSystemAdmin, // 只有系統管理員可以管理使用者權限
                }
            })
        } catch (err) {
            return res.status(500).json({ error: err.message })
        }
    }

    // DELETE: Revoke permissions (set role back to 'user')
    if (method === 'DELETE') {
        const { userId, requesterId } = req.body

        if (!userId || !requesterId) {
            return res.status(400).json({ error: 'userId and requesterId are required' })
        }

        try {
            const { data: requester } = await supabaseAdmin
                .from('users').select('role').eq('id', requesterId).single()

            if (!['system_admin', 'platform_manager'].includes(requester?.role)) {
                return res.status(403).json({ error: '權限不足' })
            }

            if (userId === requesterId) {
                return res.status(400).json({ error: '無法撤銷自己的權限' })
            }

            const { data: targetUser } = await supabaseAdmin
                .from('users').select('name, role').eq('id', userId).single()

            if (!targetUser) {
                return res.status(404).json({ error: '找不到該使用者' })
            }

            if (!canManageRole(requester?.role, targetUser.role)) {
                return res.status(403).json({ error: '權限不足：無法管理此使用者' })
            }

            const { error } = await supabaseAdmin
                .from('users')
                .update({ role: 'user', permissions: {} })
                .eq('id', userId)

            if (error) throw error

            return res.status(200).json({
                message: `已將「${targetUser.name}」設為前台使用者`
            })
        } catch (err) {
            console.error('Error revoking permissions:', err)
            return res.status(500).json({ error: err.message })
        }
    }

    return res.status(405).json({ error: 'Method not allowed' })
}
