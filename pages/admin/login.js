import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

export default function AdminLoginPage() {
    const router = useRouter()
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Check if user is logged in to frontend
        const userId = localStorage.getItem('userId')
        const userName = localStorage.getItem('userName')

        if (!userId) {
            // Not logged in, redirect to login
            router.push('/login?returnUrl=/admin')
            return
        }

        // Verify admin status
        checkAdminStatus(userId, userName)
    }, [])

    async function checkAdminStatus(userId, userName) {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',  // Fixed: Changed from PUT to POST for permission check
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            })
            const data = await res.json()

            if (data.hasAdminAccess) {
                // User has backend access, grant access and store permissions
                localStorage.setItem('adminAuth', 'true')
                localStorage.setItem('adminAuthTime', Date.now().toString())
                localStorage.setItem('isAdmin', data.isAdmin ? 'true' : 'false')
                localStorage.setItem('userRole', data.role)
                localStorage.setItem('userPermissions', JSON.stringify(data.permissions || {}))

                const returnUrl = router.query.returnUrl || '/admin'
                router.push(returnUrl)
            } else {
                setError(`帳號「${userName}」沒有後台權限。請聯繫系統管理員或平台管理者開通權限。`)
                setLoading(false)
            }
        } catch (err) {
            setError('驗證失敗，請稍後再試')
            setLoading(false)
        }
    }

    const handleLogoutAndRetry = () => {
        localStorage.removeItem('userId')
        localStorage.removeItem('userName')
        localStorage.removeItem('adminAuth')
        router.push('/login?returnUrl=/admin')
    }

    if (loading) {
        return (
            <div style={styles.container}>
                <div style={styles.loginCard}>
                    <div style={styles.header}>
                        <span style={styles.icon}>🔐</span>
                        <h1 style={styles.title}>驗證管理員權限</h1>
                    </div>
                    <p style={styles.description}>
                        正在驗證您的帳號權限...
                    </p>
                    <div style={styles.loading}>⏳ 驗證中...</div>
                </div>
            </div>
        )
    }

    return (
        <div style={styles.container}>
            <div style={styles.loginCard}>
                <div style={styles.header}>
                    <span style={styles.icon}>🔐</span>
                    <h1 style={styles.title}>管理員登入</h1>
                </div>

                <p style={styles.description}>
                    Prompt 管理後台僅限管理員使用
                </p>

                {error && <div style={styles.error}>{error}</div>}

                <div style={styles.buttonGroup}>
                    <button
                        onClick={handleLogoutAndRetry}
                        style={styles.retryButton}
                    >
                        🔄 切換帳號
                    </button>
                    <a href="/dashboard" style={styles.dashboardLink}>
                        返回 Dashboard
                    </a>
                </div>

                <a href="/" style={styles.backLink}>← 返回首頁</a>
            </div>
        </div>
    )
}

const styles = {
    container: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #fef5e7 0%, #fff5f5 50%, #f0fdf4 100%)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
    },
    loginCard: {
        background: '#fff',
        borderRadius: 20,
        border: '3px solid #1a1a2e',
        boxShadow: '8px 8px 0 #1a1a2e',
        padding: 40,
        width: '100%',
        maxWidth: 420,
        textAlign: 'center'
    },
    header: {
        marginBottom: 24
    },
    icon: {
        fontSize: 48,
        display: 'block',
        marginBottom: 12
    },
    title: {
        fontSize: 28,
        fontWeight: 700,
        color: '#1a1a2e',
        margin: 0
    },
    description: {
        fontSize: 15,
        color: '#6b7280',
        marginBottom: 32
    },
    loading: {
        fontSize: 16,
        color: '#4361ee',
        padding: 20
    },
    error: {
        background: '#fef2f2',
        color: '#dc2626',
        padding: '16px 20px',
        borderRadius: 12,
        marginBottom: 24,
        fontSize: 14,
        border: '2px solid #fecaca',
        textAlign: 'left',
        lineHeight: 1.5
    },
    buttonGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        marginBottom: 24
    },
    retryButton: {
        padding: '14px 24px',
        fontSize: 16,
        fontWeight: 600,
        background: '#4361ee',
        color: '#fff',
        border: '3px solid #1a1a2e',
        borderRadius: 12,
        cursor: 'pointer',
        boxShadow: '4px 4px 0 #1a1a2e'
    },
    dashboardLink: {
        padding: '12px 24px',
        fontSize: 14,
        fontWeight: 500,
        background: '#f3f4f6',
        color: '#374151',
        border: '2px solid #e5e7eb',
        borderRadius: 10,
        textDecoration: 'none'
    },
    backLink: {
        color: '#6b7280',
        textDecoration: 'none',
        fontSize: 14
    }
}
