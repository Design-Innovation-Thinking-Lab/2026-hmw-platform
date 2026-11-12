import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
})

export default async function handler(req, res) {
    const { method } = req

    // GET: Get transcripts for a room
    if (method === 'GET') {
        const { roomId } = req.query

        if (!roomId) {
            return res.status(400).json({ error: 'Missing roomId' })
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
        const { room_id, uploader_id, file_name, content } = req.body

        if (!room_id || !uploader_id || !content) {
            return res.status(400).json({ error: '請提供完整資料' })
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
        const { id, uploader_id } = req.body

        if (!id) {
            return res.status(400).json({ error: 'Missing transcript ID' })
        }

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
