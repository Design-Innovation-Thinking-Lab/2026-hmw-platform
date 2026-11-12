import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import {
    Lock,
    GraduationCap,
    Briefcase,
    AlertTriangle,
    Rocket,
    ArrowLeft
} from '../components/icons'

export default function LoginPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [loginType, setLoginType] = useState('student')

    const [studentId, setStudentId] = useState('')
    const [email, setEmail] = useState('')
    const [verificationPassword, setVerificationPassword] = useState('')

    useEffect(() => {
        const userId = localStorage.getItem('userId')
        if (userId) {
            const returnUrl = router.query.returnUrl || '/dashboard'
            router.push(returnUrl)
        }
    }, [router])

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        if (loginType === 'student') {
            if (!studentId.trim()) { setError('請輸入學號'); setLoading(false); return }
            if (!verificationPassword.trim()) { setError('請輸入驗證密碼'); setLoading(false); return }
        }
        if (loginType === 'other') {
            if (!email.trim()) { setError('請輸入 Email'); setLoading(false); return }
            if (!verificationPassword.trim()) { setError('請輸入驗證密碼'); setLoading(false); return }
        }

        try {
            const res = await fetch('/api/users/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    login_type: loginType,
                    student_id: loginType === 'student' ? studentId.toUpperCase() : null,
                    email: loginType === 'other' ? email.trim() : null,
                    verification_password: verificationPassword
                })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            localStorage.setItem('userId', data.user.id)
            localStorage.setItem('userName', data.user.name)

            // Check if user must change password
            if (data.user.must_change_password) {
                router.push('/change-password')
                return
            }

            const returnUrl = router.query.returnUrl || '/dashboard'
            router.push(returnUrl)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-header">
                    <Lock size={32} color="#4361ee" />
                    <h1 className="auth-title">登入平台</h1>
                </div>
                <p className="auth-subtitle">使用您的學號或 Email 登入</p>

                {error && <div className="alert alert-error">{error}</div>}

                {/* Login Type Selector */}
                <div className="type-selector">
                    <button
                        type="button"
                        onClick={() => setLoginType('student')}
                        className={`type-btn ${loginType === 'student' ? 'type-btn-active' : ''}`}
                    >
                        <GraduationCap size={18} /> 學生登入
                    </button>
                    <button
                        type="button"
                        onClick={() => setLoginType('other')}
                        className={`type-btn ${loginType === 'other' ? 'type-btn-active' : ''}`}
                    >
                        <Briefcase size={18} /> 其他身份
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    {loginType === 'student' ? (
                        <div className="form-group">
                            <label className="form-label">學號</label>
                            <input
                                type="text"
                                value={studentId}
                                onChange={e => setStudentId(e.target.value.toUpperCase())}
                                placeholder="例：M11400000"
                                className="form-input"
                                autoFocus
                            />
                            <small className="form-hint">請輸入您註冊時填寫的學號</small>
                        </div>
                    ) : (
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="請輸入您的 Email"
                                className="form-input"
                                autoFocus
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">驗證密碼</label>
                        <input
                            type="password"
                            value={verificationPassword}
                            onChange={e => setVerificationPassword(e.target.value)}
                            placeholder="請輸入驗證密碼"
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

                    <button
                        type="submit"
                        className="btn btn-success btn-full"
                        style={{ marginTop: 8 }}
                        disabled={loading}
                    >
                        {loading ? '登入中...' : (
                            <><Rocket size={20} /> 登入</>
                        )}
                    </button>
                </form>

                <div className="auth-footer">
                    <p className="auth-footer-text">還沒有帳號？</p>
                    <a href="/register" className="auth-link">立即註冊 →</a>
                </div>

                <a href="/" className="auth-back-link" style={{ marginTop: 8 }}>
                    <ArrowLeft size={16} /> 返回首頁
                </a>
            </div>
        </div>
    )
}
