import { supabaseAdmin } from '../../lib/serverAuth'
import { MIN_PASSWORD_LENGTH } from '../../lib/password'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default async function handler(req, res) {
    const { method } = req

    // POST: Create new user
    if (method === 'POST') {
        const {
            name,
            age,
            occupation,
            // Login credentials（密碼只交給 Supabase Auth，不存進 users 表）
            student_id,
            email,
            password,
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

        const normalizedEmail = typeof email === 'string' ? email.toLowerCase().trim() : ''
        if (!normalizedEmail || !EMAIL_PATTERN.test(normalizedEmail)) {
            return res.status(400).json({ error: '請輸入正確的 Email（登入用）' })
        }

        if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
            return res.status(400).json({ error: `密碼至少需要 ${MIN_PASSWORD_LENGTH} 個字元` })
        }

        let authUserId = null
        try {
            const userData = {
                name,
                age: age ? parseInt(age) : null,
                occupation,
                email: normalizedEmail
            }

            // Check if email already exists
            const { data: existingEmail } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('email', normalizedEmail)
                .maybeSingle()

            if (existingEmail) {
                return res.status(400).json({ error: '此 Email 已被註冊，請直接登入' })
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
                    .maybeSingle()

                if (existingStudent) {
                    return res.status(400).json({ error: '此學號已被註冊，請直接登入' })
                }

                userData.student_id = student_id.toUpperCase()
                userData.school = school
                userData.department = department
                userData.major = major
                userData.grade = grade
            } else {
                userData.industry = industry
                userData.position = position
                userData.highest_education_school = highest_education_school
                userData.highest_education_department = highest_education_department
                userData.highest_education_major = highest_education_major
                userData.highest_education_grade = highest_education_grade
            }

            // 1. 在 Supabase Auth 建帳號，密碼由 Supabase 保管。
            //    在伺服器端建立並直接設成已驗證：Supabase 內建的寄信服務只寄給專案成員，
            //    學生收不到驗證信。
            const { data: created, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email: normalizedEmail,
                password,
                email_confirm: true
            })

            if (authError || !created?.user) {
                console.error('Error creating auth user:', authError)
                // 錯誤代碼見 @supabase/auth-js 的 lib/error-codes
                const code = authError?.code
                if (code === 'email_exists' || code === 'user_already_exists') {
                    return res.status(400).json({ error: '此 Email 已被註冊，請直接登入' })
                }
                if (code === 'weak_password') {
                    return res.status(400).json({ error: '密碼不符合規則，請換一組更長或更複雜的密碼' })
                }
                return res.status(500).json({ error: '建立帳號失敗，請稍後再試' })
            }
            authUserId = created.user.id

            // 2. users 表的 id 和 Supabase Auth 的帳號 id 相同，其他資料表照舊用 users.id
            const { data, error } = await supabaseAdmin
                .from('users')
                .insert({ ...userData, id: authUserId })
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
            // users 寫入失敗時，刪掉剛建立的 Auth 帳號，避免留下沒有資料的帳號
            if (authUserId) {
                const { error: cleanupError } = await supabaseAdmin.auth.admin.deleteUser(authUserId)
                if (cleanupError) console.error('Error cleaning up auth user:', cleanupError)
            }
            return res.status(500).json({ error: '建立帳號失敗，請稍後再試' })
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
