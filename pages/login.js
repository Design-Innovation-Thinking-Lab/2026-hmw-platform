import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import {
    Lock,
    Rocket,
    ArrowLeft
} from '../components/icons'
import { supabase } from '../lib/supabaseClient'
import { loadProfile, nextPathAfterLogin } from '../lib/session'
import GoogleButton from '../components/GoogleButton'

export default function LoginPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    // 已經登入就直接往下走
    useEffect(() => {
        if (!router.isReady) return
        let cancelled = false
        ;(async () => {
            const { data } = await supabase.auth.getSession()
            if (!data?.session || cancelled) return
            const user = await loadProfile()
            if (user && !cancelled) router.replace(nextPathAfterLogin(user, router.query.returnUrl))
        })()
        return () => { cancelled = true }
    }, [router.isReady])

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError(null)

        if (!email.trim()) { setError('請輸入 Email'); return }
        if (!password) { setError('請輸入密碼'); return }

        setLoading(true)
        try {
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password,
            })
            if (signInError) {
                if (/confirm/i.test(signInError.message)) {
                    throw new Error('這個 Email 還沒有完成驗證，請先到信箱點驗證連結')
                }
                throw new Error('Email 或密碼錯誤')
            }

            const user = await loadProfile()
            if (!user) throw new Error('登入失敗，請稍後再試')

            router.push(nextPathAfterLogin(user, router.query.returnUrl))
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
                <p className="auth-subtitle">使用 Google 帳號或 Email 登入</p>

                {error && <div className="alert alert-error">{error}</div>}

                <GoogleButton
                    label="使用 Google 帳號登入"
                    returnUrl={router.query.returnUrl}
                    onError={setError}
                />

                <div className="auth-divider"><span>或使用 Email</span></div>

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
                        <small className="form-hint">
                            <a href="/forgot-password" className="auth-link">忘記密碼？</a>
                        </small>
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
