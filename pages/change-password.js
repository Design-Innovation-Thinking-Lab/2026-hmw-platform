import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Lock, AlertTriangle, Check } from '../components/icons'

export default function ChangePasswordPage() {
    const router = useRouter()
    const [userId, setUserId] = useState(null)
    const [userName, setUserName] = useState('')
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        const id = localStorage.getItem('userId')
        const name = localStorage.getItem('userName')
        if (!id) {
            router.push('/login')
            return
        }
        setUserId(id)
        setUserName(name || '')
    }, [])

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError(null)

        if (!currentPassword.trim()) {
            setError('請輸入目前密碼')
            return
        }
        if (!newPassword.trim()) {
            setError('請輸入新密碼')
            return
        }
        if (newPassword.length < 4) {
            setError('新密碼至少需要 4 個字元')
            return
        }
        if (newPassword !== confirmPassword) {
            setError('新密碼與確認密碼不一致')
            return
        }
        if (newPassword === currentPassword) {
            setError('新密碼不能與目前密碼相同')
            return
        }

        setLoading(true)
        try {
            const res = await fetch('/api/users/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, currentPassword, newPassword })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            setSuccess(true)
            setTimeout(() => {
                const returnUrl = router.query.returnUrl || '/dashboard'
                router.push(returnUrl)
            }, 1500)
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
                    <Lock size={32} color="#f59e0b" />
                    <h1 className="auth-title">變更密碼</h1>
                </div>

                <div className="alert alert-warning" style={{ marginBottom: 24 }}>
                    <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                    <span>您的密碼已被管理員重設，請立即設定新密碼後才能繼續使用。</span>
                </div>

                {error && <div className="alert alert-error">{error}</div>}

                {success ? (
                    <div className="alert alert-success" style={{ textAlign: 'center', padding: 24 }}>
                        <Check size={24} style={{ marginBottom: 8 }} />
                        <div style={{ fontWeight: 600, fontSize: 16 }}>密碼變更成功！</div>
                        <div style={{ marginTop: 4, fontSize: 14 }}>正在為您跳轉...</div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">目前密碼</label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={e => setCurrentPassword(e.target.value)}
                                placeholder="管理員提供的臨時密碼，或你目前的密碼"
                                className="form-input"
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">新密碼</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                placeholder="請輸入新密碼（至少 4 個字元）"
                                className="form-input"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">確認新密碼</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                placeholder="再次輸入新密碼"
                                className="form-input"
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn-success btn-full"
                            style={{ marginTop: 8 }}
                            disabled={loading}
                        >
                            {loading ? '變更中...' : '確認變更密碼'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    )
}
