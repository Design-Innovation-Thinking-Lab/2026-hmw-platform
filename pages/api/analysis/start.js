import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
})

/**
 * Get the start of today in Asia/Taipei timezone as ISO string
 */
function getTodayStartTaipei() {
    const now = new Date()
    const taipeiDate = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
    return new Date(taipeiDate + 'T00:00:00+08:00').toISOString()
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const { projectId, roomId, initiatorId } = req.body

    // Either projectId or roomId is required
    if (!projectId && !roomId) {
        return res.status(400).json({ error: 'Missing projectId or roomId' })
    }

    try {
        // --- Daily Quota Check ---
        if (initiatorId) {
            const { data: user, error: userError } = await supabaseAdmin
                .from('users')
                .select('daily_analysis_quota, role')
                .eq('id', initiatorId)
                .single()

            if (!userError && user && user.role !== 'system_admin') {
                const dailyQuota = user.daily_analysis_quota ?? 3

                const todayStart = getTodayStartTaipei()
                const { count, error: countError } = await supabaseAdmin
                    .from('analysis_runs')
                    .select('*', { count: 'exact', head: true })
                    .eq('initiator_id', initiatorId)
                    .gte('created_at', todayStart)

                if (!countError) {
                    const usedToday = count || 0
                    if (usedToday >= dailyQuota) {
                        return res.status(429).json({
                            error: `今日分析次數已達上限（${dailyQuota} 次/天）。如需更多次數，請聯繫管理員。`,
                            quotaExceeded: true,
                            dailyQuota,
                            usedToday
                        })
                    }
                }
            }
        }
        // --- End Quota Check ---
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
                    initiator_id: initiatorId || null,
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

        // Original project-based analysis
        const { data, error } = await supabaseAdmin
            .from('analysis_runs')
            .insert({
                project_id: projectId,
                initiator_id: initiatorId || null,
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
