import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import {
    FileText,
    GraduationCap,
    Briefcase,
    Sparkles
} from '../components/icons'
import { apiFetch } from '../lib/apiFetch'
import { supabase } from '../lib/supabaseClient'
import { loadProfile, logout } from '../lib/session'

// 註冊（或第一次用 Google 登入）之後，補填個人資料。
// 帳號本身（Email、密碼）由 Supabase Auth 管理；這裡只存 public.users 的個人資料。
export default function ProfileSetupPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const [formData, setFormData] = useState({
        name: '',
        age: '',
        occupation: '',
        student_id: '',
        school: '',
        department: '',
        major: '',
        grade: '',
        industry: '',
        position: '',
        highest_education_school: '',
        highest_education_department: '',
        highest_education_major: '',
        highest_education_grade: ''
    })

    const isStudent = formData.occupation === 'student'

    const [email, setEmail] = useState('')

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            const { data } = await supabase.auth.getSession()
            if (!data?.session) {
                router.replace('/login?returnUrl=/profile-setup')
                return
            }
            const user = await loadProfile()
            if (cancelled || !user) return
            setEmail(user.email || '')
            setFormData(prev => ({
                ...prev,
                name: prev.name || user.name || '',
                occupation: prev.occupation || user.occupation || '',
                student_id: prev.student_id || user.student_id || '',
            }))
        })()
        return () => { cancelled = true }
    }, [])

    const handleLogout = async () => {
        await logout()
        router.push('/login')
    }

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        if (!formData.name.trim()) { setError('請輸入姓名'); setLoading(false); return }
        if (!formData.occupation) { setError('請選擇職業'); setLoading(false); return }

        try {
            const studentFields = ['student_id', 'school', 'department', 'major', 'grade']
            const otherFields = ['industry', 'position', 'highest_education_school',
                'highest_education_department', 'highest_education_major', 'highest_education_grade']
            const payload = { ...formData }
            // 只送和職業相符的欄位，另一組清空
            ;(isStudent ? otherFields : studentFields).forEach(k => { payload[k] = null })
            if (isStudent && payload.student_id) payload.student_id = payload.student_id.toUpperCase()

            const res = await apiFetch('/api/users/me', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            localStorage.setItem('userName', data.user.name)
            const returnUrl = router.query.returnUrl
            const safe = typeof returnUrl === 'string' && returnUrl.startsWith('/') && !returnUrl.startsWith('//')
            router.push(safe ? returnUrl : '/dashboard')
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="auth-page" style={{ alignItems: 'flex-start' }}>
            <div className="auth-card auth-card-wide">
                <div className="auth-header">
                    <FileText size={28} color="#1a1a2e" />
                    <h1 className="auth-title">填寫個人資料</h1>
                </div>
                <p className="auth-subtitle">
                    {email ? <>目前登入：{email}<br /></> : null}
                    請填寫您的基本資料以開始使用平台
                </p>

                {error && <div className="alert alert-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                    {/* Basic Info */}
                    <div className="register-section">
                        <h3 className="register-section-title">基本資料</h3>

                        <div className="form-group">
                            <label className="form-label">姓名 *</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={e => handleChange('name', e.target.value)}
                                placeholder="請輸入您的姓名"
                                className="form-input"
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">年齡</label>
                                <input
                                    type="number"
                                    value={formData.age}
                                    onChange={e => handleChange('age', e.target.value)}
                                    placeholder="例：25"
                                    className="form-input"
                                    min="1" max="100"
                                />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">職業 *</label>
                                <select
                                    value={formData.occupation}
                                    onChange={e => handleChange('occupation', e.target.value)}
                                    className="form-select"
                                >
                                    <option value="">-- 請選擇 --</option>
                                    <option value="student">學生</option>
                                    <option value="designer">設計師</option>
                                    <option value="engineer">工程師</option>
                                    <option value="researcher">研究員</option>
                                    <option value="manager">經理/主管</option>
                                    <option value="teacher">教師</option>
                                    <option value="other">其他</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Student Fields */}
                    {isStudent && (
                        <div className="register-section">
                            <h3 className="register-section-title">
                                <GraduationCap size={20} /> 學生資料
                            </h3>

                            <div className="form-group">
                                <label className="form-label">學號</label>
                                <input
                                    type="text"
                                    value={formData.student_id}
                                    onChange={e => handleChange('student_id', e.target.value.toUpperCase())}
                                    placeholder="例：M11400000"
                                    className="form-input"
                                />
                                <small className="form-hint">選填，只作為個人資料；登入請用 Email 或 Google</small>
                            </div>

                            <div className="form-group">
                                <label className="form-label">學校</label>
                                <input
                                    type="text"
                                    value={formData.school}
                                    onChange={e => handleChange('school', e.target.value)}
                                    placeholder="例：國立台灣大學"
                                    className="form-input"
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label">科系</label>
                                    <input type="text" value={formData.department}
                                        onChange={e => handleChange('department', e.target.value)}
                                        placeholder="例：資訊工程" className="form-input" />
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label">系所</label>
                                    <input type="text" value={formData.major}
                                        onChange={e => handleChange('major', e.target.value)}
                                        placeholder="例：研究所" className="form-input" />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">年級</label>
                                <select value={formData.grade}
                                    onChange={e => handleChange('grade', e.target.value)}
                                    className="form-select">
                                    <option value="">-- 請選擇 --</option>
                                    <option value="freshman">大一</option>
                                    <option value="sophomore">大二</option>
                                    <option value="junior">大三</option>
                                    <option value="senior">大四</option>
                                    <option value="master1">碩一</option>
                                    <option value="master2">碩二</option>
                                    <option value="phd">博士生</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Non-Student Fields */}
                    {formData.occupation && !isStudent && (
                        <div className="register-section">
                            <h3 className="register-section-title">
                                <Briefcase size={20} /> 職業資料
                            </h3>

                            <div className="form-row">
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label">行業別</label>
                                    <input type="text" value={formData.industry}
                                        onChange={e => handleChange('industry', e.target.value)}
                                        placeholder="例：科技業" className="form-input" />
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label">職位</label>
                                    <input type="text" value={formData.position}
                                        onChange={e => handleChange('position', e.target.value)}
                                        placeholder="例：資深設計師" className="form-input" />
                                </div>
                            </div>

                            <h4 className="register-sub-title">最高學歷</h4>

                            <div className="form-group">
                                <label className="form-label">學校</label>
                                <input type="text" value={formData.highest_education_school}
                                    onChange={e => handleChange('highest_education_school', e.target.value)}
                                    placeholder="例：國立台灣大學" className="form-input" />
                            </div>

                            <div className="form-row">
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label">科系</label>
                                    <input type="text" value={formData.highest_education_department}
                                        onChange={e => handleChange('highest_education_department', e.target.value)}
                                        placeholder="例：設計系" className="form-input" />
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label">系所</label>
                                    <input type="text" value={formData.highest_education_major}
                                        onChange={e => handleChange('highest_education_major', e.target.value)}
                                        placeholder="例：碩士" className="form-input" />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">年級 (選填)</label>
                                <input type="text" value={formData.highest_education_grade}
                                    onChange={e => handleChange('highest_education_grade', e.target.value)}
                                    placeholder="例：2022年畢業" className="form-input" />
                            </div>
                        </div>
                    )}

                    <button type="submit" className="btn btn-success btn-full" disabled={loading}
                        style={{ marginBottom: 20 }}>
                        {loading ? '儲存中...' : (
                            <><Sparkles size={18} /> 開始使用平台</>
                        )}
                    </button>
                </form>

                <button type="button" className="auth-back-link" onClick={handleLogout}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%' }}>
                    登出，改用其他帳號
                </button>
            </div>
        </div>
    )
}
