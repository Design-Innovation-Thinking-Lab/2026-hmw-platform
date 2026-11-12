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

    const { login_type, student_id, email, verification_password } = req.body

    try {
        let user = null

        if (login_type === 'student') {
            // Login with student ID + verification password
            if (!student_id) {
                return res.status(400).json({ error: '請輸入學號' })
            }
            if (!verification_password) {
                return res.status(400).json({ error: '請輸入驗證密碼' })
            }

            const { data, error } = await supabaseAdmin
                .from('users')
                .select('id, name, occupation, is_admin, must_change_password')
                .eq('student_id', student_id.toUpperCase())
                .eq('verification_password', verification_password)
                .single()

            if (error || !data) {
                return res.status(401).json({ error: '學號或驗證密碼錯誤' })
            }

            user = data
        } else {
            // Login with email + verification password
            if (!email) {
                return res.status(400).json({ error: '請輸入 Email' })
            }
            if (!verification_password) {
                return res.status(400).json({ error: '請輸入驗證密碼' })
            }

            const { data, error } = await supabaseAdmin
                .from('users')
                .select('id, name, occupation, is_admin, must_change_password')
                .eq('email', email.toLowerCase().trim())
                .eq('verification_password', verification_password)
                .single()

            if (error || !data) {
                return res.status(401).json({ error: 'Email 或驗證密碼錯誤' })
            }

            user = data
        }

        // 不回傳敏感資訊
        const safeUser = {
            id: user.id,
            name: user.name,
            occupation: user.occupation,
            is_admin: user.is_admin || false,
            must_change_password: user.must_change_password || false
        }

        return res.status(200).json({ success: true, user: safeUser })
    } catch (err) {
        console.error('Login error:', err)
        return res.status(500).json({ error: err.message })
    }
}
