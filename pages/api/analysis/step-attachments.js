import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
})

export default async function handler(req, res) {
    const { method } = req

    // GET: Fetch all attachments for a specific step
    if (method === 'GET') {
        const { stepId } = req.query

        if (!stepId) {
            return res.status(400).json({ error: 'Missing stepId' })
        }

        try {
            const { data, error } = await supabaseAdmin
                .from('analysis_step_attachments')
                .select('*')
                .eq('step_id', stepId)
                .order('created_at', { ascending: true })

            if (error) throw error

            return res.status(200).json({ attachments: data || [] })
        } catch (err) {
            console.error('Error fetching attachments:', err)
            return res.status(500).json({ error: err.message })
        }
    }

    // POST: Create a new attachment record
    if (method === 'POST') {
        const { stepId, fileName, storageUrl, mimeType, fileSize, fileType, description } = req.body

        if (!stepId || !fileName || !storageUrl) {
            return res.status(400).json({ error: 'Missing required fields: stepId, fileName, storageUrl' })
        }

        try {
            const { data, error } = await supabaseAdmin
                .from('analysis_step_attachments')
                .insert({
                    step_id: stepId,
                    file_name: fileName,
                    storage_path: storageUrl,
                    mime_type: mimeType,
                    file_size: fileSize,
                    file_type: fileType || 'reference',
                    description: description || null
                })
                .select()
                .single()

            if (error) throw error

            return res.status(200).json({
                success: true,
                attachment: data
            })
        } catch (err) {
            console.error('Error creating attachment:', err)
            return res.status(500).json({ error: err.message })
        }
    }

    // DELETE: Remove an attachment
    if (method === 'DELETE') {
        const { attachmentId } = req.body

        if (!attachmentId) {
            return res.status(400).json({ error: 'Missing attachmentId' })
        }

        try {
            // 1. Get attachment info before deletion
            const { data: attachment, error: fetchError } = await supabaseAdmin
                .from('analysis_step_attachments')
                .select('storage_path')
                .eq('id', attachmentId)
                .single()

            if (fetchError) throw fetchError

            // 2. Delete from storage
            if (attachment?.storage_path) {
                const { error: storageError } = await supabaseAdmin.storage
                    .from('analysis-files')
                    .remove([attachment.storage_path])

                if (storageError) {
                    console.warn('Storage deletion warning:', storageError)
                    // Continue even if storage deletion fails
                }
            }

            // 3. Delete from database
            const { error: deleteError } = await supabaseAdmin
                .from('analysis_step_attachments')
                .delete()
                .eq('id', attachmentId)

            if (deleteError) throw deleteError

            return res.status(200).json({ success: true })
        } catch (err) {
            console.error('Error deleting attachment:', err)
            return res.status(500).json({ error: err.message })
        }
    }

    return res.status(405).json({ error: 'Method not allowed' })
}
