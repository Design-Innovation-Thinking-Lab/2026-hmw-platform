import { requireUser, supabaseAdmin } from '../../../lib/auth'

// 修復卡住的分析：只有系統管理員 / 平台管理者可以使用

// API to fix stuck analysis runs
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Use POST to fix runs' })
    }

    const user = await requireUser(req, res, { roles: ['system_admin', 'platform_manager'] })
    if (!user) return

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
