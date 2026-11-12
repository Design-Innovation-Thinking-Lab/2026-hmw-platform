import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
})

// API to fix stuck analysis runs
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Use POST to fix runs' })
    }

    const { runId, roomId, action } = req.body

    try {
        if (action === 'reset_room') {
            // Reset room to allow new analysis
            if (!roomId) {
                return res.status(400).json({ error: 'Missing roomId' })
            }

            const { error } = await supabaseAdmin
                .from('research_rooms')
                .update({
                    analysis_status: 'pending',
                    current_analysis_run_id: null
                })
                .eq('id', roomId)

            if (error) throw error

            return res.json({ success: true, message: 'Room reset to pending' })
        }

        if (action === 'cancel_run') {
            // Cancel stuck run
            if (!runId) {
                return res.status(400).json({ error: 'Missing runId' })
            }

            const { error } = await supabaseAdmin
                .from('analysis_runs')
                .update({
                    status: 'cancelled',
                    finished_at: new Date().toISOString(),
                    meta: { cancelled_reason: 'manual_fix' }
                })
                .eq('id', runId)

            if (error) throw error

            return res.json({ success: true, message: 'Run cancelled' })
        }

        if (action === 'complete_run') {
            // Force complete a run
            if (!runId) {
                return res.status(400).json({ error: 'Missing runId' })
            }

            const { error } = await supabaseAdmin
                .from('analysis_runs')
                .update({
                    status: 'completed',
                    finished_at: new Date().toISOString(),
                    meta: { force_completed: true, progress_percent: 100 }
                })
                .eq('id', runId)

            if (error) throw error

            return res.json({ success: true, message: 'Run force completed' })
        }

        return res.status(400).json({
            error: 'Invalid action. Use: reset_room, cancel_run, or complete_run',
            example: {
                reset_room: { action: 'reset_room', roomId: 'uuid' },
                cancel_run: { action: 'cancel_run', runId: 'uuid' },
                complete_run: { action: 'complete_run', runId: 'uuid' }
            }
        })
    } catch (err) {
        return res.status(500).json({ error: err.message })
    }
}
