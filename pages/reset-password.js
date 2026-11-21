import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Lock, Check } from '../components/icons'
import { supabase } from '../lib/supabaseClient'
import NewPasswordForm, { passwordErrorMessage } from '../components/NewPasswordForm'

// 從重設密碼信的連結進來：Supabase client 會用網址上的 code 建立暫時的 session，
// 這裡讓使用者設定新密碼。
export default function ResetPasswordPage() {
    const router = useRouter()
    const [ready, setReady] = useState(false)
    const [invalid, setInvalid] = useState(false)
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            const { data } = await supabase.auth.getSession()
            if (cancelled) return
            if (data?.session) setReady(true)
            else setInvalid(true)
        })()
        return () => { cancelled = true }
    }, [])

    const handleSubmit = async (newPassword) => {
        const { error } = await supabase.auth.updateUser({ password: newPassword })
        if (error) throw new Error(passwordErrorMessage(error))
        setSuccess(true)
        setTimeout(() => router.push('/dashboard'), 1500)
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-header">
                    <Lock size={32} color="#f59e0b" />
                    <h1 className="auth-title">設定新密碼</h1>
                </div>

                {invalid && (
                    <>
                        <div className="alert alert-error">連結已失效或已經使用過，請重新申請重設密碼。</div>
                        <a href="/forgot-password" className="btn btn-primary btn-full">重新申請</a>
                    </>
                )}

                {success && (
                    <div className="alert alert-success" style={{ textAlign: 'center', padding: 24 }}>
                        <Check size={24} style={{ marginBottom: 8 }} />
                        <div style={{ fontWeight: 600, fontSize: 16 }}>密碼已更新！</div>
                        <div style={{ marginTop: 4, fontSize: 14 }}>正在為您跳轉...</div>
                    </div>
                )}

                {ready && !success && <NewPasswordForm onSubmit={handleSubmit} submitLabel="設定新密碼" />}
            </div>
        </div>
    )
}
