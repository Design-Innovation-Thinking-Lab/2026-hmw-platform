import { supabaseAdmin, requireUser, getEffectivePermissions } from '../../lib/serverAuth'

// 是誰、什麼角色一律由登入憑證判斷（lib/serverAuth），不讀前端送來的 userId／userRole。
export default async function handler(req, res) {
    const { method } = req

    const authed = await requireUser(req, res)
    if (!authed) return
    const userId = authed.id
    const role = authed.role

    // GET: List projects with role-based filtering
    if (method === 'GET') {
        try {
            const isAdmin = ['system_admin', 'platform_manager'].includes(role)
            const hasViewResults = getEffectivePermissions(authed).view_results

            let query = supabaseAdmin
                .from('projects')
                .select('*, analysis_flow_steps(count)')
                .order('created_at', { ascending: false })

            // Role-based filtering
            if (isAdmin || hasViewResults) {
                // system_admin / platform_manager / backend_user with view_results sees all projects
                // (view_results users need all projects visible to query any room's results)
            } else if (role === 'backend_user') {
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
                is_owner: p.owner_id === userId
            }))

            return res.status(200).json({ projects: projectsWithCount })
        } catch (err) {
            return res.status(500).json({ error: err.message })
        }
    }

    // POST: Create a new project (requires mode_manager or admin role)
    if (method === 'POST') {
        const { name, description } = req.body

        if (!name || !name.trim()) {
            return res.status(400).json({ error: '分析模式名稱為必填' })
        }

        try {
            // system_admin, platform_manager, backend_user (with manage_modes) can create
            // 原本 backend_user 的 manage_modes 只在頁面上檢查，改成伺服器端檢查
            const canCreate = getEffectivePermissions(authed).manage_modes
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
        const { projectId, isDefault, name, description, isPublic } = req.body

        if (!projectId) {
            return res.status(400).json({ error: 'projectId is required' })
        }

        try {
            // Check project ownership
            const { data: existingProject } = await supabaseAdmin
                .from('projects')
                .select('owner_id')
                .eq('id', projectId)
                .single()

            const isOwner = !!existingProject && existingProject.owner_id === userId
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
        const { projectId } = req.body

        if (!projectId) {
            return res.status(400).json({ error: 'projectId is required' })
        }

        try {
            // Check project ownership
            const { data: project } = await supabaseAdmin
                .from('projects')
                .select('owner_id')
                .eq('id', projectId)
                .single()

            const isOwner = !!project && project.owner_id === userId
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
