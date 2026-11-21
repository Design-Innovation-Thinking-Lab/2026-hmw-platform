import { useState } from 'react'

export const MIN_PASSWORD_LENGTH = 8

// 「新密碼 + 確認新密碼」表單；onSubmit(newPassword) 回傳 Promise，丟出錯誤會顯示在表單上。
export default function NewPasswordForm({ onSubmit, submitLabel = '確認變更密碼', children }) {
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError(null)
        if (newPassword.length < MIN_PASSWORD_LENGTH) { setError(`新密碼至少需要 ${MIN_PASSWORD_LENGTH} 個字元`); return }
        if (newPassword !== confirmPassword) { setError('新密碼與確認密碼不一致'); return }
        setLoading(true)
        try {
            await onSubmit(newPassword)
        } catch (err) {
            setError(err.message || '變更失敗，請稍後再試')
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-error">{error}</div>}
            {children}
            <div className="form-group">
                <label className="form-label">新密碼</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    placeholder={`至少 ${MIN_PASSWORD_LENGTH} 個字元`} className="form-input" autoComplete="new-password" />
            </div>
            <div className="form-group">
                <label className="form-label">確認新密碼</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="再次輸入新密碼" className="form-input" autoComplete="new-password" />
            </div>
            <button type="submit" className="btn btn-success btn-full" style={{ marginTop: 8 }} disabled={loading}>
                {loading ? '處理中...' : submitLabel}
            </button>
        </form>
    )
}

export function passwordErrorMessage(error) {
    if (!error) return null
    if (/different from the old|same/i.test(error.message)) return '新密碼不能與目前密碼相同'
    if (/weak|password/i.test(error.message)) return '密碼強度不足，請改用更長、更不容易猜的密碼'
    return '變更失敗，請稍後再試'
}
