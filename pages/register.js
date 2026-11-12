import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import {
    FileText,
    GraduationCap,
    Briefcase,
    AlertTriangle,
    Sparkles,
    ArrowLeft,
    ArrowRight
} from '../components/icons'

export default function RegisterPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const [formData, setFormData] = useState({
        name: '',
        age: '',
        occupation: '',
        student_id: '',
        email: '',
        verification_password: '',
        confirm_password: '',
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

    useEffect(() => {
        const userId = localStorage.getItem('userId')
        if (userId) router.push('/dashboard')
    }, [router])

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        if (!formData.name.trim()) { setError('請輸入姓名'); setLoading(false); return }
        if (!formData.occupation) { setError('請選擇職業'); setLoading(false); return }

        if (isStudent && !formData.student_id.trim()) { setError('請輸入學號'); setLoading(false); return }
        if (!isStudent && !formData.email.trim()) { setError('請輸入 Email'); setLoading(false); return }
        if (!formData.verification_password) { setError('請設定驗證密碼'); setLoading(false); return }
        if (formData.verification_password.length < 4) { setError('驗證密碼至少需要 4 個字元'); setLoading(false); return }
        if (formData.verification_password !== formData.confirm_password) { setError('兩次輸入的密碼不一致'); setLoading(false); return }

        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    student_id: isStudent ? formData.student_id.toUpperCase() : null,
                    email: !isStudent ? formData.email.trim() : null
                })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            localStorage.setItem('userId', data.user.id)
            localStorage.setItem('userName', data.user.name)
            router.push('/dashboard')
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
                    <h1 className="auth-title">使用者註冊</h1>
                </div>
                <p className="auth-subtitle">請填寫您的基本資料以開始使用平台</p>

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
                                <label className="form-label">
                                    學號 * <span className="required-label">(登入用)</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.student_id}
                                    onChange={e => handleChange('student_id', e.target.value.toUpperCase())}
                                    placeholder="例：M11400000"
                                    className="form-input"
                                />
                                <small className="form-hint">學號將作為您未來登入的唯一識別碼</small>
                            </div>

                            <div className="form-group">
                                <label className="form-label">
                                    驗證密碼 * <span className="required-label">(登入用)</span>
                                </label>
                                <input
                                    type="password"
                                    value={formData.verification_password}
                                    onChange={e => handleChange('verification_password', e.target.value)}
                                    placeholder="請設定驗證密碼（至少 4 字元）"
                                    className="form-input"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">確認密碼 *</label>
                                <input
                                    type="password"
                                    value={formData.confirm_password}
                                    onChange={e => handleChange('confirm_password', e.target.value)}
                                    placeholder="再次輸入驗證密碼"
                                    className="form-input"
                                />
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

                            <div className="form-group">
                                <label className="form-label">
                                    Email * <span className="required-label">(登入用)</span>
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => handleChange('email', e.target.value)}
                                    placeholder="請輸入您的 Email"
                                    className="form-input"
                                />
                                <small className="form-hint">Email 將作為您未來登入的唯一識別碼</small>
                            </div>

                            <div className="form-group">
                                <label className="form-label">
                                    驗證密碼 * <span className="required-label">(登入用)</span>
                                </label>
                                <input
                                    type="password"
                                    value={formData.verification_password}
                                    onChange={e => handleChange('verification_password', e.target.value)}
                                    placeholder="請設定驗證密碼（至少 4 字元）"
                                    className="form-input"
                                />
                                <div className="alert alert-warning" style={{ marginTop: 8, marginBottom: 0 }}>
                                    <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                                    <span>
                                        此為唯一驗證入口。如遺失請 email 洽研究者變更：
                                        <a href="mailto:drhhtang@gapps.ntust.edu.tw" style={{ color: '#b45309', fontWeight: 500 }}>
                                            drhhtang@gapps.ntust.edu.tw
                                        </a>
                                    </span>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">確認密碼 *</label>
                                <input type="password" value={formData.confirm_password}
                                    onChange={e => handleChange('confirm_password', e.target.value)}
                                    placeholder="再次輸入驗證密碼" className="form-input" />
                            </div>

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

                <div className="auth-footer">
                    <p className="auth-footer-text">已經有帳號？</p>
                    <a href="/login" className="auth-link">
                        立即登入 <ArrowRight size={14} />
                    </a>
                </div>

                <a href="/" className="auth-back-link" style={{ marginTop: 8 }}>
                    <ArrowLeft size={16} /> 返回首頁
                </a>
            </div>
        </div>
    )
}
