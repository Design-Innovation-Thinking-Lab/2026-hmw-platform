import { supabaseAdmin, requirePermission } from '../../../lib/serverAuth'

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    // 後台「分析結果」頁的房間下拉選單：需要 view_results
    const authed = await requirePermission(req, res, 'view_results')
    if (!authed) return

    try {
        const { data: rooms, error } = await supabaseAdmin
            .from('research_rooms')
            .select('id, name, room_code, created_at, analysis_status')
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching rooms:', error)
            return res.status(500).json({ error: error.message, rooms: [] })
        }

        const formattedRooms = (rooms || []).map(room => ({
            id: room.id,
            name: room.name || room.room_code || `Room ${room.id.slice(0, 8)}`,
            code: room.room_code,
            created_at: room.created_at,
            analysis_status: room.analysis_status
        }))

        return res.status(200).json({ rooms: formattedRooms })
    } catch (err) {
        console.error('Unexpected error:', err)
        return res.status(500).json({ error: err.message, rooms: [] })
    }
}
