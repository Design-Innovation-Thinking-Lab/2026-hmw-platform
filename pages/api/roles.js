import { requireUser, supabaseAdmin } from '../../lib/auth'

export default async function handler(req, res) {
    const { method } = req
    const { projectId } = req.query

    // 分析角色（含 system prompt）只給後台使用者；修改需要 manage_roles
    const user = await requireUser(req, res, { backend: true })
    if (!user) return

    // GET: List all roles (optionally filtered by project)
    if (method === 'GET') {
        try {
            let query = supabaseAdmin
                .from('analysis_roles')
                .select('*, projects(id, name)')
                .order('created_at', { ascending: true })

            // If projectId is provided, filter by it
            if (projectId) {
                query = query.eq('project_id', projectId)
            }

            const { data: roles, error } = await query

            if (error) throw error

            return res.status(200).json({ roles })
        } catch (err) {
            return res.status(500).json({ error: err.message })
        }
    }

    // POST: Create or update a role
    if (method === 'POST') {
        if (!user.perms.manage_roles) {
            return res.status(403).json({ error: '權限不足' })
        }
        const { type, data } = req.body

        try {
            if (type === 'role') {
                // Upsert role
                const { error } = await supabaseAdmin
                    .from('analysis_roles')
                    .upsert({
                        ...data,
                        updated_at: new Date().toISOString()
                    })
                if (error) throw error
            } else if (type === 'delete_role') {
                // Delete role
                const { error } = await supabaseAdmin
                    .from('analysis_roles')
                    .delete()
                    .eq('id', data.id)
                if (error) throw error
            } else {
                return res.status(400).json({ error: 'Invalid type' })
            }

            return res.status(200).json({ success: true })
        } catch (err) {
            return res.status(500).json({ error: err.message })
        }
    }

    return res.status(405).json({ error: 'Method not allowed' })
}
