import { requireUser, supabaseAdmin, canViewRoom, isAdmin } from '../../../lib/auth'

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const user = await requireUser(req, res)
    if (!user) return

    const { runId } = req.body

    if (!runId) {
        return res.status(400).json({ error: 'Missing runId' })
    }

    try {
        // 研究室的分析：研究室成員可以取消；沒有研究室的分析：只有發起者或管理員
        const { data: existing } = await supabaseAdmin
            .from('analysis_runs')
            .select('id, room_id, initiator_id')
            .eq('id', runId)
            .maybeSingle()

        if (!existing) {
            return res.status(404).json({ error: '找不到此分析' })
        }

        const allowed = existing.room_id
            ? await canViewRoom(user, existing.room_id)
            : (existing.initiator_id === user.id || isAdmin(user))
        if (!allowed) {
            return res.status(403).json({ error: '權限不足' })
        }

        const roomId = existing.room_id
        // Update analysis run status to cancelled
        const { data: run, error: runError } = await supabaseAdmin
            .from('analysis_runs')
            .update({
                status: 'cancelled',
                finished_at: new Date().toISOString(),
                meta: { cancelled_at: new Date().toISOString() }
            })
            .eq('id', runId)
            .select()
            .single()

        if (runError) throw runError

        // 研究室的分析：同步更新研究室狀態
        if (roomId) {
            await supabaseAdmin
                .from('research_rooms')
                .update({
                    analysis_status: 'cancelled',
                    current_analysis_run_id: null
                })
                .eq('id', roomId)
        }

        return res.status(200).json({
            success: true,
            message: '分析已取消'
        })
    } catch (err) {
        console.error('Error cancelling analysis:', err)
        return res.status(500).json({ error: err.message })
    }
}
