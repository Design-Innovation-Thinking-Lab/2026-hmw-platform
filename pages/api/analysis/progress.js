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

    const { runId, roomId } = req.query

    try {
        let run = null

        if (runId) {
            const { data, error } = await supabaseAdmin
                .from('analysis_runs')
                .select('id, status, meta, project_id, created_at, started_at, finished_at')
                .eq('id', runId)
                .single()

            if (error) throw error
            run = data
        } else if (roomId) {
            const { data: room } = await supabaseAdmin
                .from('research_rooms')
                .select('current_analysis_run_id, analysis_status')
                .eq('id', roomId)
                .single()

            if (room?.current_analysis_run_id) {
                const { data, error } = await supabaseAdmin
                    .from('analysis_runs')
                    .select('id, status, meta, project_id, created_at, started_at, finished_at')
                    .eq('id', room.current_analysis_run_id)
                    .single()

                if (error) throw error
                run = data
            }
        }

        if (!run) {
            return res.status(200).json({ status: 'idle', progress: null, completedSteps: [] })
        }

        // Fetch project name
        let projectName = null
        if (run.project_id) {
            const { data: project } = await supabaseAdmin
                .from('projects')
                .select('name')
                .eq('id', run.project_id)
                .single()
            projectName = project?.name || null
        }

        // Fetch ALL completed step results (success and error) for live display
        const { data: completedResults } = await supabaseAdmin
            .from('analysis_results')
            .select(`
                id, status, result_json, created_at,
                analysis_flow_steps ( step_index, title, analysis_scope )
            `)
            .eq('analysis_run_id', run.id)
            .in('status', ['success', 'error'])
            .not('result_json', 'is', null)
            .order('created_at', { ascending: true })

        const completedSteps = (completedResults || []).map(r => ({
            stepIndex: r.analysis_flow_steps?.step_index ?? null,
            title: r.analysis_flow_steps?.title || '分析步驟',
            scope: r.analysis_flow_steps?.analysis_scope || null,
            resultJson: r.result_json,
            hasError: r.status === 'error',
            completedAt: r.created_at
        }))

        return res.status(200).json({
            runId: run.id,
            status: run.status,
            projectName,
            progress: run.meta ? {
                totalSteps: run.meta.total_steps || 0,
                currentStep: run.meta.current_step || 0,
                currentStepTitle: run.meta.current_step_title || '',
                progressPercent: run.meta.progress_percent || 0
            } : null,
            completedSteps,
            startedAt: run.started_at,
            finishedAt: run.finished_at
        })
    } catch (err) {
        console.error('Error fetching progress:', err)
        return res.status(500).json({ error: err.message })
    }
}
