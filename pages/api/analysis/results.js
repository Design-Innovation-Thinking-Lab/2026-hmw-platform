import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
})

export default async function handler(req, res) {
    const { method } = req
    const { projectId, runId, stepId, roomId, startDate, endDate } = req.query

    if (method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    // At least one filter must be provided
    if (!projectId && !roomId && !runId && !startDate && !endDate) {
        return res.status(400).json({ error: 'Please provide at least one filter' })
    }

    try {
        // Fetch all rooms for the filter dropdown
        const { data: allRooms } = await supabaseAdmin
            .from('research_rooms')
            .select('id, name, room_code, created_at')
            .order('created_at', { ascending: false })

        const rooms = (allRooms || []).map(room => ({
            id: room.id,
            name: room.name || `Room ${room.id.slice(0, 8)}`,
            room_code: room.room_code
        }))

        // Build analysis_runs query — supports any combination of filters
        let runsQuery = supabaseAdmin
            .from('analysis_runs')
            .select('*, research_rooms!analysis_runs_room_id_fkey(id, name, room_code), projects(id, name)')
            .order('created_at', { ascending: false })

        if (projectId) runsQuery = runsQuery.eq('project_id', projectId)
        if (roomId)    runsQuery = runsQuery.eq('room_id', roomId)
        if (runId)     runsQuery = runsQuery.eq('id', runId)
        if (startDate) {
            // Parse as Taiwan time (UTC+8) so date filter aligns with user expectation
            runsQuery = runsQuery.gte('created_at', new Date(startDate + 'T00:00:00+08:00').toISOString())
        }
        if (endDate) {
            runsQuery = runsQuery.lte('created_at', new Date(endDate + 'T23:59:59+08:00').toISOString())
        }

        const { data: allRuns, error: runsError } = await runsQuery
        if (runsError) throw runsError

        // Build analysis_results query
        let query = supabaseAdmin
            .from('analysis_results')
            .select(`
                *,
                analysis_flow_steps ( id, step_index, title, analysis_scope ),
                files ( id, filename ),
                analysis_runs ( id, room_id, project_id )
            `)
            .order('created_at', { ascending: true })

        if (projectId) query = query.eq('project_id', projectId)
        if (runId)     query = query.eq('analysis_run_id', runId)
        if (stepId)    query = query.eq('step_id', stepId)

        // Filter by room via analysis_runs join (if no runId already narrows it)
        if (roomId && !runId) {
            const runIds = (allRuns || []).map(r => r.id)
            if (runIds.length === 0) {
                return res.status(200).json({ results: [], runs: [], rooms, steps: [] })
            }
            query = query.in('analysis_run_id', runIds)
        }

        // Date filter on results when no projectId/roomId but dates provided
        if (!projectId && !roomId && !runId && (startDate || endDate)) {
            const runIds = (allRuns || []).map(r => r.id)
            if (runIds.length === 0) {
                return res.status(200).json({ results: [], runs: [], rooms, steps: [] })
            }
            query = query.in('analysis_run_id', runIds)
        }

        let { data: results, error } = await query
        if (error) throw error

        // Fetch steps — from project if known, else from all runs' projects
        let allSteps = []
        const projectIds = projectId
            ? [projectId]
            : [...new Set((allRuns || []).map(r => r.project_id).filter(Boolean))]

        if (projectIds.length > 0) {
            const { data: stepsData } = await supabaseAdmin
                .from('analysis_flow_steps')
                .select('*')
                .in('project_id', projectIds)
                .eq('is_active', true)
                .order('step_index', { ascending: true })
            allSteps = stepsData || []
        }

        return res.status(200).json({
            results: results || [],
            runs: allRuns || [],
            rooms,
            steps: allSteps
        })

    } catch (err) {
        console.error('Error fetching results:', err)
        return res.status(500).json({ error: err.message })
    }
}
