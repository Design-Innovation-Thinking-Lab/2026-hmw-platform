import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
})

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const { runId, roomId } = req.body

    if (!runId) {
        return res.status(400).json({ error: 'Missing runId' })
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
