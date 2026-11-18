import { supabaseAdmin, requireUser, requireRoomMember } from '../../lib/serverAuth'

// 逐字稿所屬的房間
async function roomIdOfTranscript(id) {
    const { data } = await supabaseAdmin
        .from('room_transcripts')
        .select('room_id')
        .eq('id', id)
        .maybeSingle()
    return data?.room_id || null
}

// 逐字稿是研究資料：一律要登入，而且是該房間的成員。
// 房間成員都可以編輯、刪除房間裡的逐字稿（和 pages/room/[id].js 的畫面一致）。
export default async function handler(req, res) {
    const { method } = req

    const authed = await requireUser(req, res)
    if (!authed) return

    // GET: Get transcripts for a room
    if (method === 'GET') {
        const { roomId } = req.query

        if (!roomId) {
            return res.status(400).json({ error: 'Missing roomId' })
        }
        if (!(await requireRoomMember(res, authed, roomId))) return

        try {
            const { data, error } = await supabaseAdmin
                .from('room_transcripts')
                .select('*, users(name)')
                .eq('room_id', roomId)
                .order('created_at', { ascending: true })

            if (error) throw error

            return res.status(200).json({ transcripts: data })
        } catch (err) {
            console.error('Error fetching transcripts:', err)
            return res.status(500).json({ error: err.message })
        }
    }

    // POST: Upload a new transcript
    if (method === 'POST') {
        const { room_id, file_name, content } = req.body
        const uploader_id = authed.id

        if (!room_id || !content) {
            return res.status(400).json({ error: '請提供完整資料' })
        }
        if (!(await requireRoomMember(res, authed, room_id))) return

        try {
            const { data, error } = await supabaseAdmin
                .from('room_transcripts')
                .insert({
                    room_id,
                    uploader_id,
                    file_name: file_name || '逐字稿',
                    content
                })
                .select('*, users(name)')
                .single()

            if (error) throw error

            return res.status(200).json({ success: true, transcript: data })
        } catch (err) {
            console.error('Error uploading transcript:', err)
            return res.status(500).json({ error: err.message })
        }
    }

    // DELETE: Delete a transcript
    if (method === 'DELETE') {
        const { id } = req.body

        if (!id) {
            return res.status(400).json({ error: 'Missing transcript ID' })
        }
        const deleteRoomId = await roomIdOfTranscript(id)
        if (!deleteRoomId) return res.status(404).json({ error: '找不到這份逐字稿' })
        if (!(await requireRoomMember(res, authed, deleteRoomId))) return

        try {
            const { error } = await supabaseAdmin
                .from('room_transcripts')
                .delete()
                .eq('id', id)

            if (error) throw error

            return res.status(200).json({ success: true })
        } catch (err) {
            console.error('Error deleting transcript:', err)
            return res.status(500).json({ error: err.message })
        }
    }

    // PUT: Update a transcript
    if (method === 'PUT') {
        const { id, file_name, content } = req.body

        if (!id) {
            return res.status(400).json({ error: 'Missing transcript ID' })
        }
        const updateRoomId = await roomIdOfTranscript(id)
        if (!updateRoomId) return res.status(404).json({ error: '找不到這份逐字稿' })
        if (!(await requireRoomMember(res, authed, updateRoomId))) return

        try {
            const updateData = {}
            if (file_name !== undefined) updateData.file_name = file_name
            if (content !== undefined) updateData.content = content
            updateData.updated_at = new Date().toISOString()

            const { data, error } = await supabaseAdmin
                .from('room_transcripts')
                .update(updateData)
                .eq('id', id)
                .select('*, users(name)')
                .single()

            if (error) throw error

            return res.status(200).json({ success: true, transcript: data })
        } catch (err) {
            console.error('Error updating transcript:', err)
            return res.status(500).json({ error: err.message })
        }
    }

    return res.status(405).json({ error: 'Method not allowed' })
}
