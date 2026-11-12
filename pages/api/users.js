import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
})

export default async function handler(req, res) {
    const { method } = req

    // POST: Create new user
    if (method === 'POST') {
        const {
            name,
            age,
            occupation,
            // Login credentials
            student_id,
            email,
            verification_password,
            // Student fields
            school,
            department,
            major,
            grade,
            // Non-student fields
            industry,
            position,
            highest_education_school,
            highest_education_department,
            highest_education_major,
            highest_education_grade
        } = req.body

        if (!name || !occupation) {
            return res.status(400).json({ error: '姓名和職業為必填欄位' })
        }

        if (!verification_password) {
            return res.status(400).json({ error: '請設定驗證密碼' })
        }

        try {
            const userData = {
                name,
                age: age ? parseInt(age) : null,
                occupation,
                verification_password
            }

            // Add fields based on occupation type
            if (occupation === 'student') {
                if (!student_id) {
                    return res.status(400).json({ error: '學生必須填寫學號' })
                }

                // Check if student_id already exists
                const { data: existingStudent } = await supabaseAdmin
                    .from('users')
                    .select('id')
                    .eq('student_id', student_id.toUpperCase())
                    .single()

                if (existingStudent) {
                    return res.status(400).json({ error: '此學號已被註冊，請直接登入' })
                }

                userData.student_id = student_id.toUpperCase()
                userData.school = school
                userData.department = department
                userData.major = major
                userData.grade = grade
            } else {
                if (!email) {
                    return res.status(400).json({ error: '非學生必須填寫 Email' })
                }

                // Check if email already exists
                const { data: existingEmail } = await supabaseAdmin
                    .from('users')
                    .select('id')
                    .eq('email', email.toLowerCase().trim())
                    .single()

                if (existingEmail) {
                    return res.status(400).json({ error: '此 Email 已被註冊，請直接登入' })
                }

                userData.email = email.toLowerCase().trim()
                userData.industry = industry
                userData.position = position
                userData.highest_education_school = highest_education_school
                userData.highest_education_department = highest_education_department
                userData.highest_education_major = highest_education_major
                userData.highest_education_grade = highest_education_grade
            }

            const { data, error } = await supabaseAdmin
                .from('users')
                .insert(userData)
                .select()
                .single()

            if (error) throw error

            // 不回傳敏感資訊
            const safeUser = {
                id: data.id,
                name: data.name,
                occupation: data.occupation
            }

            return res.status(200).json({ success: true, user: safeUser })
        } catch (err) {
            console.error('Error creating user:', err)
            return res.status(500).json({ error: err.message })
        }
    }


    // GET: Get user by ID
    if (method === 'GET') {
        const { id } = req.query

        if (!id) {
            return res.status(400).json({ error: 'Missing user ID' })
        }

        try {
            const { data, error } = await supabaseAdmin
                .from('users')
                .select('id, name, occupation, email, student_id, role, created_at')
                .eq('id', id)
                .single()

            if (error) throw error

            return res.status(200).json({ user: data })
        } catch (err) {
            console.error('Error fetching user:', err)
            return res.status(500).json({ error: err.message })
        }
    }

    return res.status(405).json({ error: 'Method not allowed' })
}
