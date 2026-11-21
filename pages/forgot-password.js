import { useState } from 'react'
import { Lock, ArrowLeft } from '../components/icons'
import { supabase } from '../lib/supabaseClient'

// 忘記密碼：寄出重設密碼信，連結會回到 /reset-password
export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [sent, setSent] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError(null)
        const cleanEmail = email.trim().toLowerCase()
        if (!cleanEmail) { setError('請輸入 Email'); return }
        setLoading(true)
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
            redirectTo: `${window.location.origin}/reset-password`,
        })
        setLoading(false)
        if (resetError) {
            setError('寄送失敗，請稍後再試')
            return
        }
        // 不透露這個 Email 有沒有註冊過
        setSent(true)
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-header">
                    <Lock size={32} color="#4361ee" />
                    <h1 className="auth-title">忘記密碼</h1>
                </div>

                {sent ? (
                    <p className="auth-subtitle">
                        如果 <strong>{email.trim()}</strong> 有註冊過，重設密碼信已經寄出。請到信箱點連結設定新密碼。
                        <br />用 Google 註冊的帳號請直接用 Google 登入。
                    </p>
                ) : (
                    <form onSubmit={handleSubmit}>
                        {error && <div className="alert alert-error">{error}</div>}
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                                placeholder="請輸入註冊時的 Email" className="form-input" autoComplete="email" />
                        </div>
                        <button type="submit" className="btn btn-success btn-full" disabled={loading}>
                            {loading ? '寄送中...' : '寄送重設密碼信'}
                        </button>
                    </form>
                )}

                <a href="/login" className="auth-back-link" style={{ marginTop: 16 }}>
                    <ArrowLeft size={16} /> 回到登入頁
                </a>
            </div>
        </div>
    )
}
