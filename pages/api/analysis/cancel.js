import { supabaseAdmin, requireUser, requireRoomMember, isAdminRole } from '../../../lib/serverAuth'

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const { runId, roomId } = req.body

    if (!runId) {
        return res.status(400).json({ error: 'Missing runId' })
    }

    // 取消分析：要是這個分析所屬房間的成員（沒有房間的分析只有管理員可以取消）
    const authed = await requireUser(req, res)
    if (!authed) return

    const { data: target } = await supabaseAdmin
        .from('analysis_runs')
        .select('id, room_id')
        .eq('id', runId)
        .maybeSingle()
    if (!target) {
        return res.status(404).json({ error: '找不到這個分析' })
    }
    if (target.room_id) {
        if (roomId && roomId !== target.room_id) {
            return res.status(400).json({ error: 'roomId 和分析不符' })
        }
        if (!(await requireRoomMember(res, authed, target.room_id))) return
    } else if (!isAdminRole(authed.role)) {
        return res.status(403).json({ error: '權限不足' })
    }

    try {
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

        // If roomId is provided, update room status
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
