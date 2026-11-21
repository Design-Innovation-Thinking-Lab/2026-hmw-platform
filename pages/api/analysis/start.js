import { requireUser, supabaseAdmin, getQuotaStatus, isRoomMember, canEditProject } from '../../../lib/auth'

/**
 * 一般使用者只能用預設或公開的分析模式；自己擁有的（或管理員）可以用任何模式。
 */
async function canUseProject(user, projectId) {
    const { data: project } = await supabaseAdmin
        .from('projects')
        .select('id, is_default, is_public, owner_id')
        .eq('id', projectId)
        .maybeSingle()
    if (!project) return false
    if (project.is_default || project.is_public) return true
    return canEditProject(user, projectId)
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    // 會呼叫 LLM（花研究室的錢）：一定要登入、填完個人資料、檢查額度
    const user = await requireUser(req, res, { profile: true })
    if (!user) return

    const { projectId, roomId } = req.body
    const initiatorId = user.id

    // Either projectId or roomId is required
    if (!projectId && !roomId) {
        return res.status(400).json({ error: 'Missing projectId or roomId' })
    }

    try {
        // --- Daily Quota Check（一律檢查，不能略過）---
        const quota = await getQuotaStatus(user)
        if (!quota.unlimited && quota.remaining <= 0) {
            return res.status(429).json({
                error: `今日分析次數已達上限（${quota.dailyQuota} 次/天）。如需更多次數，請聯繫管理員。`,
                quotaExceeded: true,
                dailyQuota: quota.dailyQuota,
                usedToday: quota.usedToday
            })
        }
        // --- End Quota Check ---

        if (projectId && !(await canUseProject(user, projectId))) {
            return res.status(403).json({ error: '無法使用這個分析模式' })
        }

        // If roomId is provided, fetch room details and validate transcripts
        if (roomId) {
            // Check if room exists
            const { data: room, error: roomError } = await supabaseAdmin
                .from('research_rooms')
                .select('*, room_transcripts(id)')
                .eq('id', roomId)
                .single()

            if (roomError || !room) {
                return res.status(404).json({ error: '找不到此房間' })
            }

            // 只有研究室成員可以啟動分析
            if (!(await isRoomMember(user.id, roomId))) {
                return res.status(403).json({ error: '只有研究室成員可以啟動分析' })
            }

            // 同一個研究室同時只跑一個分析
            if (room.analysis_status === 'analyzing' && room.current_analysis_run_id) {
                const { data: running } = await supabaseAdmin
                    .from('analysis_runs')
                    .select('status')
                    .eq('id', room.current_analysis_run_id)
                    .maybeSingle()
                if (running && ['pending', 'processing', 'running'].includes(running.status)) {
                    return res.status(409).json({ error: '這個研究室已經有分析在進行中' })
                }
            }

            // Ensure at least one transcript exists
            if (!room.room_transcripts || room.room_transcripts.length === 0) {
                return res.status(400).json({ error: '請先上傳至少一份逐字稿' })
            }

            // Use projectId from request (user's mode selection) if provided,
            // otherwise fall back to room's existing project_id
            let effectiveProjectId = projectId || room.project_id
            if (!effectiveProjectId) {
                const { data: defaultProjects } = await supabaseAdmin
                    .from('projects')
                    .select('id')
                    .eq('is_default', true)
                    .limit(1)

                if (defaultProjects && defaultProjects.length > 0) {
                    effectiveProjectId = defaultProjects[0].id
                } else {
                    return res.status(400).json({ error: '請先在管理後台設定預設專案' })
                }
            }

            if (!(await canUseProject(user, effectiveProjectId))) {
                return res.status(403).json({ error: '無法使用這個分析模式' })
            }

            // Update room's project_id to the selected mode
            if (effectiveProjectId !== room.project_id) {
                await supabaseAdmin
                    .from('research_rooms')
                    .update({ project_id: effectiveProjectId })
                    .eq('id', roomId)
            }

            // Create analysis run for room
            const { data: run, error: runError } = await supabaseAdmin
                .from('analysis_runs')
                .insert({
                    room_id: roomId,
                    project_id: effectiveProjectId,
                    initiator_id: initiatorId,
                    status: 'pending'
                })
                .select()
                .single()

            if (runError) throw runError

            // Update room analysis status
            await supabaseAdmin
                .from('research_rooms')
                .update({
                    analysis_status: 'analyzing',
                    current_analysis_run_id: run.id
                })
                .eq('id', roomId)

            return res.status(200).json({
                success: true,
                runId: run.id,
                roomId: roomId,
                message: '分析已開始，請稍候...'
            })
        }

        // 沒有研究室的分析（舊流程）：只有能編輯該模式的後台使用者可以啟動
        if (!(await canEditProject(user, projectId))) {
            return res.status(403).json({ error: '權限不足' })
        }

        const { data, error } = await supabaseAdmin
            .from('analysis_runs')
            .insert({
                project_id: projectId,
                initiator_id: initiatorId,
                status: 'pending'
            })
            .select()
            .single()

        if (error) throw error

        return res.status(200).json({ success: true, runId: data.id })
    } catch (err) {
        console.error('Error starting analysis:', err)
        return res.status(500).json({ error: err.message })
    }
}
