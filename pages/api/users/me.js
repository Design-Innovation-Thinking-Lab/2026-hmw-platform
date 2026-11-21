/**
 * /api/users/me — 目前登入者的資料
 * GET：讀取（含角色、實際權限、個人資料是否已填完）
 * PUT：更新自己的個人資料（不能改角色、權限、額度、email）
 */
import { requireUser, supabaseAdmin, hasBackendAccess } from '../../../lib/auth'

const PROFILE_FIELDS = [
    'name', 'age', 'occupation', 'student_id',
    'school', 'department', 'major', 'grade',
    'industry', 'position',
    'highest_education_school', 'highest_education_department',
    'highest_education_major', 'highest_education_grade',
]

function toResponse(user) {
    const role = user.role || 'user'
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        student_id: user.student_id,
        occupation: user.occupation,
        role,
        permissions: user.perms,
        created_at: user.created_at,
        profileComplete: !!user.occupation,
        // 舊前端相容
        isAdmin: role === 'system_admin',
        isModeManager: role === 'platform_manager' || role === 'system_admin',
        canManageProjects: user.perms.manage_modes,
        hasBackendAccess: hasBackendAccess(user),
    }
}

export default async function handler(req, res) {
    const user = await requireUser(req, res)
    if (!user) return

    if (req.method === 'GET') {
        return res.status(200).json({ user: toResponse(user) })
    }

    if (req.method === 'PUT') {
        const body = req.body || {}
        const update = {}
        for (const key of PROFILE_FIELDS) {
            if (body[key] === undefined) continue
            const value = typeof body[key] === 'string' ? body[key].trim() : body[key]
            update[key] = value === '' ? null : value
        }

        if ('name' in update && !update.name) {
            return res.status(400).json({ error: '請輸入姓名' })
        }
        if ('occupation' in update && !update.occupation) {
            return res.status(400).json({ error: '請選擇職業' })
        }
        if (!user.occupation && !update.occupation) {
            return res.status(400).json({ error: '請選擇職業' })
        }
        if (update.age !== undefined && update.age !== null) {
            const age = parseInt(update.age, 10)
            if (isNaN(age) || age < 1 || age > 120) {
                return res.status(400).json({ error: '年齡格式不正確' })
            }
            update.age = age
        }
        if (update.student_id) update.student_id = String(update.student_id).toUpperCase()

        const { error } = await supabaseAdmin.from('users').update(update).eq('id', user.id)
        if (error) {
            console.error('Error updating profile:', error)
            return res.status(500).json({ error: '儲存失敗' })
        }

        const merged = { ...user, ...update }
        return res.status(200).json({ success: true, user: toResponse(merged) })
    }

    return res.status(405).json({ error: 'Method not allowed' })
}
