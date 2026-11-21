import { requireUser, supabaseAdmin, canViewRoom, isRoomMember, isAdmin } from '../../lib/auth'

/**
 * 修改 / 刪除逐字稿：上傳者本人、研究室建立者、或管理員。
 * 回傳逐字稿（含 room_id），沒有權限回傳 null。
 */
async function loadEditableTranscript(user, id) {
    const { data: transcript } = await supabaseAdmin
        .from('room_transcripts')
        .select('id, room_id, uploader_id')
        .eq('id', id)
        .maybeSingle()
    if (!transcript) return { transcript: null, allowed: false }
    if (transcript.uploader_id === user.id || isAdmin(user)) return { transcript, allowed: true }
    const { data: room } = await supabaseAdmin
        .from('research_rooms')
        .select('creator_id')
        .eq('id', transcript.room_id)
        .maybeSingle()
    return { transcript, allowed: room?.creator_id === user.id }
}

export default async function handler(req, res) {
    const { method } = req

    // 逐字稿是研究資料：一律要登入，並確認是研究室成員
    const user = await requireUser(req, res)
    if (!user) return

    // GET: Get transcripts for a room
    if (method === 'GET') {
        const { roomId } = req.query

        if (!roomId) {
            return res.status(400).json({ error: 'Missing roomId' })
        }

        if (!(await canViewRoom(user, roomId))) {
            return res.status(403).json({ error: '權限不足' })
        }

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
        const uploader_id = user.id

        if (!room_id || !content) {
            return res.status(400).json({ error: '請提供完整資料' })
        }

        if (!(await isRoomMember(user.id, room_id))) {
            return res.status(403).json({ error: '只有研究室成員可以上傳逐字稿' })
        }

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

        const { transcript, allowed } = await loadEditableTranscript(user, id)
        if (!transcript) return res.status(404).json({ error: '找不到逐字稿' })
        if (!allowed) return res.status(403).json({ error: '只有上傳者或研究室建立者可以刪除' })

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

        const { transcript, allowed } = await loadEditableTranscript(user, id)
        if (!transcript) return res.status(404).json({ error: '找不到逐字稿' })
        if (!allowed) return res.status(403).json({ error: '只有上傳者或研究室建立者可以修改' })

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
