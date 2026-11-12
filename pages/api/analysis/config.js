import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
})

export default async function handler(req, res) {
    const { method } = req
    const { projectId } = req.query

    if (!projectId && method === 'GET') {
        return res.status(400).json({ error: 'Missing projectId' })
    }

    // GET: Fetch config (Steps + Roles)
    if (method === 'GET') {
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
