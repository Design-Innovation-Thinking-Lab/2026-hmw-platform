import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import {
    Lock,
    AlertTriangle,
    Rocket,
    ArrowLeft
} from '../components/icons'
import { supabase } from '../lib/supabaseClient'

export default function LoginPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

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

        if (!email.trim()) { setError('請輸入 Email'); setLoading(false); return }
        if (!password) { setError('請輸入密碼'); setLoading(false); return }

        try {
            // 1. 交給 Supabase Auth 驗證 email＋密碼
            const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password
            })
            if (authError || !auth?.session) {
                // 帳號不存在和密碼錯誤用同一個訊息，不透露帳號是否存在
                throw new Error('Email 或密碼錯誤')
            }

            // 2. 帶著 Supabase 的登入憑證向伺服器取得使用者資料
            const res = await fetch('/api/users/login', {
                method: 'POST',
                headers: { Authorization: `Bearer ${auth.session.access_token}` }
            })

            const data = await res.json()
            if (!res.ok) {
                await supabase.auth.signOut({ scope: 'local' })
                throw new Error(data.error)
            }

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
                <p className="auth-subtitle">使用您註冊時填寫的 Email 登入</p>

                {error && <div className="alert alert-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="請輸入您的 Email"
                            className="form-input"
                            autoComplete="email"
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">密碼</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="請輸入密碼"
                            className="form-input"
                            autoComplete="current-password"
                        />
                        <div className="alert alert-warning" style={{ marginTop: 8, marginBottom: 0 }}>
                            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                            <span>
                                忘記密碼請 email 洽研究者重設：
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
