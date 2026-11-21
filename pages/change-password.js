import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Lock, Check } from '../components/icons'
import { supabase } from '../lib/supabaseClient'
import NewPasswordForm, { passwordErrorMessage } from '../components/NewPasswordForm'

// 已登入的使用者自己變更密碼：先用目前密碼重新驗證一次，再設定新密碼。
export default function ChangePasswordPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [hasPassword, setHasPassword] = useState(true)
    const [currentPassword, setCurrentPassword] = useState('')
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        ;(async () => {
            const { data } = await supabase.auth.getUser()
            if (!data?.user) {
                router.push('/login?returnUrl=/change-password')
                return
            }
            setEmail(data.user.email || '')
            const providers = data.user.app_metadata?.providers || []
            setHasPassword(providers.includes('email'))
        })()
    }, [])

    const handleSubmit = async (newPassword) => {
        if (!currentPassword) throw new Error('請輸入目前密碼')
        if (newPassword === currentPassword) throw new Error('新密碼不能與目前密碼相同')

        const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword })
        if (verifyError) throw new Error('目前密碼不正確')

        const { error } = await supabase.auth.updateUser({ password: newPassword })
        if (error) throw new Error(passwordErrorMessage(error))

        setSuccess(true)
        setTimeout(() => {
            const returnUrl = router.query.returnUrl
            const safe = typeof returnUrl === 'string' && returnUrl.startsWith('/') && !returnUrl.startsWith('//')
            router.push(safe ? returnUrl : '/dashboard')
        }, 1500)
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-header">
                    <Lock size={32} color="#f59e0b" />
                    <h1 className="auth-title">變更密碼</h1>
                </div>

                {success ? (
                    <div className="alert alert-success" style={{ textAlign: 'center', padding: 24 }}>
                        <Check size={24} style={{ marginBottom: 8 }} />
                        <div style={{ fontWeight: 600, fontSize: 16 }}>密碼變更成功！</div>
                        <div style={{ marginTop: 4, fontSize: 14 }}>正在為您跳轉...</div>
                    </div>
                ) : !hasPassword ? (
                    <p className="auth-subtitle">
                        這個帳號是用 Google 登入的，沒有另外設定密碼。
                        如果想加上 Email 密碼登入，請到 <a href="/forgot-password" className="auth-link">忘記密碼</a> 寄送設定密碼信。
                    </p>
                ) : (
                    <NewPasswordForm onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">目前密碼</label>
                            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                                placeholder="請輸入目前密碼" className="form-input" autoComplete="current-password" autoFocus />
                        </div>
                    </NewPasswordForm>
                )}
            </div>
        </div>
    )
}
