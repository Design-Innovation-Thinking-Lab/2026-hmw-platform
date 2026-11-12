import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
})

export default async function handler(req, res) {
    const { method } = req

    // GET: List projects with role-based filtering
    if (method === 'GET') {
        const { userId, userRole } = req.query

        try {
            // Fetch user role if not provided
            let role = userRole
            let userDbPermissions = {}
            if (userId && !role) {
                const { data: user } = await supabaseAdmin
                    .from('users')
                    .select('role, permissions')
                    .eq('id', userId)
                    .single()
                role = user?.role || 'user'
                userDbPermissions = user?.permissions || {}
            }

            const isAdmin = ['system_admin', 'platform_manager'].includes(role)
            const hasViewResults = isAdmin || (role === 'backend_user' && !!userDbPermissions.view_results)
            const hasManageModes = isAdmin || (role === 'backend_user' && userId)

            let query = supabaseAdmin
                .from('projects')
                .select('*, analysis_flow_steps(count)')
                .order('created_at', { ascending: false })

            // Role-based filtering
            if (isAdmin || hasViewResults) {
                // system_admin / platform_manager / backend_user with view_results sees all projects
                // (view_results users need all projects visible to query any room's results)
            } else if (role === 'backend_user' && userId) {
                // backend_user without view_results sees their own projects only
                query = query.eq('owner_id', userId)
            } else {
                // Regular users see only public or default projects
                query = query.or('is_default.eq.true,is_public.eq.true')
            }

            const { data: projects, error } = await query

            if (error) throw error

            // Transform to include step count and ownership info
            const projectsWithCount = projects.map(p => ({
                ...p,
                step_count: p.analysis_flow_steps?.[0]?.count || 0,
                is_owner: userId && p.owner_id === userId
            }))

            return res.status(200).json({ projects: projectsWithCount })
        } catch (err) {
            return res.status(500).json({ error: err.message })
        }
    }

    // POST: Create a new project (requires mode_manager or admin role)
    if (method === 'POST') {
        const { name, description, userId, userRole } = req.body

        if (!name || !name.trim()) {
            return res.status(400).json({ error: '分析模式名稱為必填' })
        }

        try {
            // Check user role
            let role = userRole
            if (userId && !role) {
                const { data: user } = await supabaseAdmin
                    .from('users')
                    .select('role, permissions')
                    .eq('id', userId)
                    .single()
                role = user?.role || 'user'
            }

            // system_admin, platform_manager, backend_user (with manage_modes) can create
            const canCreate = ['system_admin', 'platform_manager'].includes(role) ||
                (role === 'backend_user') // backend_user permission checked at page level
            if (!canCreate) {
                return res.status(403).json({ error: '權限不足：只有管理員或授權的後台使用者可以建立分析模式' })
            }

            const { data: project, error } = await supabaseAdmin
                .from('projects')
                .insert({
                    name: name.trim(),
                    description: description?.trim() || null,
                    owner_id: role === 'backend_user' ? userId : null // backend_user owns their projects
                })
                .select()
                .single()

            if (error) throw error

            return res.status(201).json({ project })
        } catch (err) {
            return res.status(500).json({ error: err.message })
        }
    }

    // PUT: Update project (requires ownership or admin)
    if (method === 'PUT') {
        const { projectId, isDefault, name, description, isPublic, userId, userRole } = req.body

        if (!projectId) {
            return res.status(400).json({ error: 'projectId is required' })
        }

        try {
            // Check user role and ownership
            let role = userRole
            if (userId && !role) {
                const { data: user } = await supabaseAdmin
                    .from('users')
                    .select('role')
                    .eq('id', userId)
                    .single()
                role = user?.role || 'user'
            }

            // Check project ownership
            const { data: existingProject } = await supabaseAdmin
                .from('projects')
                .select('owner_id')
                .eq('id', projectId)
                .single()

            const isOwner = userId && existingProject?.owner_id === userId
            const isAdmin = ['system_admin', 'platform_manager'].includes(role)

            // Only owner or admin can edit
            if (!isOwner && !isAdmin) {
                return res.status(403).json({ error: '權限不足：只有專案擁有者或管理員可以編輯' })
            }

            // Only system_admin can set default (allows multiple defaults)
            if (isDefault !== undefined && role !== 'system_admin') {
                return res.status(403).json({ error: '權限不足：只有系統管理員可以設定預設模式' })
            }

            // Build update object
            const updateData = {}
            if (isDefault !== undefined) updateData.is_default = isDefault
            if (name !== undefined) updateData.name = name.trim()
            if (description !== undefined) updateData.description = description?.trim() || null
            if (isPublic !== undefined) updateData.is_public = isPublic

            // Update the target project
            const { data: project, error } = await supabaseAdmin
                .from('projects')
                .update(updateData)
                .eq('id', projectId)
                .select()
                .single()

            if (error) throw error

            return res.status(200).json({ project })
        } catch (err) {
            return res.status(500).json({ error: err.message })
        }
    }

    // DELETE: Delete a project (requires ownership or admin)
    if (method === 'DELETE') {
        const { projectId, userId, userRole } = req.body

        if (!projectId) {
            return res.status(400).json({ error: 'projectId is required' })
        }

        try {
            // Check user role
            let role = userRole
            if (userId && !role) {
                const { data: user } = await supabaseAdmin
                    .from('users')
                    .select('role')
                    .eq('id', userId)
                    .single()
                role = user?.role || 'user'
            }

            // Check project ownership
            const { data: project } = await supabaseAdmin
                .from('projects')
                .select('owner_id')
                .eq('id', projectId)
                .single()

            const isOwner = userId && project?.owner_id === userId
            const isAdmin = ['system_admin', 'platform_manager'].includes(role)

            // Only owner or admin can delete
            if (!isOwner && !isAdmin) {
                return res.status(403).json({ error: '權限不足：只有專案擁有者或管理員可以刪除' })
            }

            // Delete related data first
            // Delete analysis_flow_steps
            await supabaseAdmin
                .from('analysis_flow_steps')
                .delete()
                .eq('project_id', projectId)

            // Delete analysis_roles
            await supabaseAdmin
                .from('analysis_roles')
                .delete()
                .eq('project_id', projectId)

            // Delete analysis_results
            await supabaseAdmin
                .from('analysis_results')
                .delete()
                .eq('project_id', projectId)

            // Delete analysis_runs
            await supabaseAdmin
                .from('analysis_runs')
                .delete()
                .eq('project_id', projectId)

            // Finally delete the project
            const { error } = await supabaseAdmin
                .from('projects')
                .delete()
                .eq('id', projectId)

            if (error) throw error

            return res.status(200).json({ success: true })
        } catch (err) {
            return res.status(500).json({ error: err.message })
        }
    }

    return res.status(405).json({ error: 'Method not allowed' })
}
