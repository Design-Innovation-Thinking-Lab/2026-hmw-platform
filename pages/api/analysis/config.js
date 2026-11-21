import { requireUser, supabaseAdmin, canEditProject } from '../../../lib/auth'

/**
 * 找出這次寫入會影響到的所有 project（新資料的 project_id + 既有步驟原本的 project_id），
 * 每一個都要能編輯才放行，避免把別人的步驟改到自己的模式底下或反過來。
 */
async function affectedProjectIds(stepRows, stepIds) {
    const ids = new Set()
    for (const row of stepRows) {
        if (row?.project_id) ids.add(row.project_id)
    }
    const existingIds = [...stepIds, ...stepRows.map(r => r?.id)].filter(Boolean)
    if (existingIds.length > 0) {
        const { data } = await supabaseAdmin
            .from('analysis_flow_steps')
            .select('id, project_id')
            .in('id', existingIds)
        for (const row of data || []) ids.add(row.project_id)
    }
    return [...ids]
}

async function canEditAll(user, projectIds) {
    if (projectIds.length === 0) return false
    for (const pid of projectIds) {
        if (!(await canEditProject(user, pid))) return false
    }
    return true
}

export default async function handler(req, res) {
    const { method } = req
    const { projectId } = req.query

    const user = await requireUser(req, res, { backend: true })
    if (!user) return

    if (!projectId && method === 'GET') {
        return res.status(400).json({ error: 'Missing projectId' })
    }

    // GET: Fetch config (Steps + Roles)
    if (method === 'GET') {
        if (!user.perms.manage_modes) {
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

        try {
            if (type === 'role') {
                if (!user.perms.manage_roles) {
                    return res.status(403).json({ error: '權限不足' })
                }
            } else {
                let stepRows = []
                let stepIds = []
                if (type === 'step') stepRows = Array.isArray(data) ? data : [data]
                else if (type === 'delete_step') stepIds = [data?.id]
                else if (type === 'reorder') stepIds = Array.isArray(data?.orderedIds) ? data.orderedIds : []

                const projectIds = await affectedProjectIds(stepRows, stepIds)
                if (!(await canEditAll(user, projectIds))) {
                    return res.status(403).json({ error: '權限不足：只能編輯自己擁有的分析模式' })
                }
            }

            if (type === 'step') {
                const { error } = await supabaseAdmin.from('analysis_flow_steps').upsert(data)
                if (error) throw error
            } else if (type === 'role') {
                const { error } = await supabaseAdmin.from('analysis_roles').upsert(data)
                if (error) throw error
            } else if (type === 'delete_step') {
                const { error } = await supabaseAdmin.from('analysis_flow_steps').delete().eq('id', data.id)
                if (error) throw error
            } else if (type === 'reorder') {
                // Batch update step_index based on new order
                // To avoid unique constraint conflicts, first set all to negative temporary values
                const { orderedIds } = data
                if (!Array.isArray(orderedIds)) {
                    return res.status(400).json({ error: 'orderedIds must be an array' })
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
