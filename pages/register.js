import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import {
    FileText,
    Sparkles,
    ArrowLeft,
    ArrowRight
} from '../components/icons'
import { supabase } from '../lib/supabaseClient'
import { loadProfile, nextPathAfterLogin } from '../lib/session'
import GoogleButton from '../components/GoogleButton'

const MIN_PASSWORD_LENGTH = 8

// 建立帳號：Google 或 Email + 密碼（Supabase Auth）。
// 帳號建立後到 /profile-setup 填個人資料。
export default function RegisterPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [sentTo, setSentTo] = useState(null)

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            const { data } = await supabase.auth.getSession()
            if (!data?.session || cancelled) return
            const user = await loadProfile()
            if (user && !cancelled) router.replace(nextPathAfterLogin(user))
        })()
        return () => { cancelled = true }
    }, [])

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError(null)

        const cleanEmail = email.trim().toLowerCase()
        if (!cleanEmail) { setError('請輸入 Email'); return }
        if (password.length < MIN_PASSWORD_LENGTH) { setError(`密碼至少需要 ${MIN_PASSWORD_LENGTH} 個字元`); return }
        if (password !== confirmPassword) { setError('兩次輸入的密碼不一致'); return }

        setLoading(true)
        try {
            const { data, error: signUpError } = await supabase.auth.signUp({
                email: cleanEmail,
                password,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/callback`,
                },
            })
            if (signUpError) {
                if (/already/i.test(signUpError.message)) throw new Error('這個 Email 已經註冊過，請直接登入')
                if (/password/i.test(signUpError.message)) throw new Error('密碼強度不足，請改用更長、更不容易猜的密碼')
                throw new Error('註冊失敗，請稍後再試')
            }

            if (data.session) {
                // 專案沒有開啟 Email 驗證：直接登入，去填個人資料
                await loadProfile()
                router.push('/profile-setup')
                return
            }

            // 需要 Email 驗證：請使用者去收信
            setSentTo(cleanEmail)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    if (sentTo) {
        return (
            <div className="auth-page">
                <div className="auth-card">
                    <div className="auth-header">
                        <FileText size={28} color="#1a1a2e" />
                        <h1 className="auth-title">請到信箱完成驗證</h1>
                    </div>
                    <p className="auth-subtitle">
                        驗證信已寄到 <strong>{sentTo}</strong>。點信裡的連結後就會登入，接著填寫個人資料。
                        沒收到的話請檢查垃圾郵件匣。
                    </p>
                    <a href="/login" className="btn btn-primary btn-full">回到登入頁</a>
                </div>
            </div>
        )
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-header">
                    <FileText size={28} color="#1a1a2e" />
                    <h1 className="auth-title">建立帳號</h1>
                </div>
                <p className="auth-subtitle">用 Google 帳號或 Email 註冊，之後再填寫個人資料</p>

                {error && <div className="alert alert-error">{error}</div>}

                <GoogleButton label="使用 Google 帳號註冊" onError={setError} />

                <div className="auth-divider"><span>或使用 Email</span></div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Email *</label>
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
                        <label className="form-label">密碼 *</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder={`至少 ${MIN_PASSWORD_LENGTH} 個字元`}
                            className="form-input"
                            autoComplete="new-password"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">確認密碼 *</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            placeholder="再次輸入密碼"
                            className="form-input"
                            autoComplete="new-password"
                        />
                    </div>

                    <button type="submit" className="btn btn-success btn-full" disabled={loading}
                        style={{ marginBottom: 20 }}>
                        {loading ? '建立中...' : (
                            <><Sparkles size={18} /> 建立帳號</>
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
