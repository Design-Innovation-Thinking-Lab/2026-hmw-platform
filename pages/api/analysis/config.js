import { supabaseAdmin, requireUser, getEffectivePermissions, canEditProject } from '../../../lib/serverAuth'

// 找出這些分析步驟屬於哪些分析模式（projects）
async function projectIdsOfSteps(stepIds) {
    const ids = stepIds.filter(Boolean)
    if (ids.length === 0) return []
    const { data, error } = await supabaseAdmin
        .from('analysis_flow_steps')
        .select('id, project_id')
        .in('id', ids)
    if (error) throw error
    return (data || []).map(s => s.project_id)
}

// 每個分析模式都要能修改（管理員，或是自己建立的 backend_user）才通過
async function canEditAll(user, projectIds) {
    const unique = [...new Set(projectIds)]
    if (unique.length === 0) return false
    for (const projectId of unique) {
        if (!(await canEditProject(user, projectId))) return false
    }
    return true
}

export default async function handler(req, res) {
    const { method } = req
    const { projectId } = req.query

    // 後台「分析步驟」頁使用：是誰、能改哪些分析模式由登入憑證判斷
    const authed = await requireUser(req, res)
    if (!authed) return

    if (!projectId && method === 'GET') {
        return res.status(400).json({ error: 'Missing projectId' })
    }

    // GET: Fetch config (Steps + Roles)
    if (method === 'GET') {
        if (!(await canEditProject(authed, projectId))) {
            return res.status(403).json({ error: '權限不足' })
        }
        try {
            const { data: steps, error: stepError } = await supabaseAdmin
                .from('analysis_flow_steps')
                .select(`
                *,
                analysis_roles ( id, name )
            `)
                .eq('project_id', projectId)
                .order('step_index')

            if (stepError) throw stepError

            // Fetch all roles (shared across all projects/analysis modes)
            const { data: roles, error: roleError } = await supabaseAdmin
                .from('analysis_roles')
                .select('*')
                .order('name')

            if (roleError) throw roleError

            return res.status(200).json({ steps, roles })
        } catch (err) {
            return res.status(500).json({ error: err.message })
        }
    }

    // POST: Update functionality (simplified for MVP: accepts full list of steps/roles updates)
    // In a real app we might want granular CRUD, but here we can handle "save config"
    if (method === 'POST') {
        const { type, data } = req.body // type: 'step' | 'role'

        if (!data || typeof data !== 'object') {
            return res.status(400).json({ error: 'Missing data' })
        }
        const forbidden = () => res.status(403).json({ error: '權限不足' })

        try {
            if (type === 'step') {
                // 新步驟看 data.project_id；修改既有步驟還要看它原本屬於哪個分析模式
                const items = Array.isArray(data) ? data : [data]
                const projectIds = [
                    ...items.map(s => s?.project_id),
                    ...(await projectIdsOfSteps(items.map(s => s?.id)))
                ]
                if (projectIds.some(id => !id) || !(await canEditAll(authed, projectIds))) return forbidden()
                const { error } = await supabaseAdmin.from('analysis_flow_steps').upsert(data)
                if (error) throw error
            } else if (type === 'role') {
                // 分析角色是所有分析模式共用的：需要 manage_roles
                if (!getEffectivePermissions(authed).manage_roles) return forbidden()
                const { error } = await supabaseAdmin.from('analysis_roles').upsert(data)
                if (error) throw error
            } else if (type === 'delete_step') {
                if (!(await canEditAll(authed, await projectIdsOfSteps([data.id])))) return forbidden()
                const { error } = await supabaseAdmin.from('analysis_flow_steps').delete().eq('id', data.id)
                if (error) throw error
            } else if (type === 'reorder') {
                // Batch update step_index based on new order
                // To avoid unique constraint conflicts, first set all to negative temporary values
                const { orderedIds } = data
                if (!Array.isArray(orderedIds)) {
                    return res.status(400).json({ error: 'orderedIds must be an array' })
                }
                const reorderProjects = await projectIdsOfSteps(orderedIds)
                if (reorderProjects.length !== orderedIds.length || !(await canEditAll(authed, reorderProjects))) {
                    return forbidden()
                }

                // Step 1: Set all step_index to temporary negative values
                for (let i = 0; i < orderedIds.length; i++) {
                    const { error } = await supabaseAdmin
                        .from('analysis_flow_steps')
                        .update({ step_index: -(i + 1) })
                        .eq('id', orderedIds[i])
                    if (error) throw error
                }

                // Step 2: Set to correct positive values
                for (let i = 0; i < orderedIds.length; i++) {
                    const { error } = await supabaseAdmin
                        .from('analysis_flow_steps')
                        .update({ step_index: i + 1, updated_at: new Date().toISOString() })
                        .eq('id', orderedIds[i])
                    if (error) throw error
                }
            } else {
                return res.status(400).json({ error: 'Invalid update type' })
            }
            return res.status(200).json({ success: true })
        } catch (err) {
            console.error('Config update error', err)
            return res.status(500).json({ error: err.message })
        }
    }

    return res.status(405).json({ error: 'Method not allowed' })
}
