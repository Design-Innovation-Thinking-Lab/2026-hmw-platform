import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
})

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const { userId } = req.query

    if (!userId) {
        return res.status(400).json({ error: 'Missing userId' })
    }

    try {
        const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('id, name, email, student_id, role, permissions, created_at')
            .eq('id', userId)
            .single()

        if (error) {
            console.error('Error fetching user:', error)
            return res.status(500).json({ error: error.message })
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' })
        }

        const role = user.role || 'user'
        const permissions = user.permissions || {}

        // Determine effective permissions based on role
        const isSystemAdmin = role === 'system_admin'
        const isPlatformManager = role === 'platform_manager'
        const isBackendUser = role === 'backend_user'

        // system_admin and platform_manager have all backend access
        // backend_user has per-feature access from permissions column
        const effectivePermissions = {
            manage_modes: isSystemAdmin || isPlatformManager || (isBackendUser && !!permissions.manage_modes),
            manage_roles: isSystemAdmin || isPlatformManager || (isBackendUser && !!permissions.manage_roles),
            view_results: isSystemAdmin || isPlatformManager || (isBackendUser && !!permissions.view_results),
            manage_users: isSystemAdmin || isPlatformManager || (isBackendUser && !!permissions.manage_users),
        }

        const hasBackendAccess = isSystemAdmin || isPlatformManager || isBackendUser

        // Return user info with role (backward compatible)
        return res.status(200).json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                student_id: user.student_id,
                role,
                permissions: effectivePermissions,
                created_at: user.created_at,
                // Backward compatibility flags
                isAdmin: isSystemAdmin,
                isModeManager: isPlatformManager || isSystemAdmin,
                canManageProjects: effectivePermissions.manage_modes,
                hasBackendAccess,
            }
        })
    } catch (err) {
        console.error('Unexpected error:', err)
        return res.status(500).json({ error: err.message })
    }
}
