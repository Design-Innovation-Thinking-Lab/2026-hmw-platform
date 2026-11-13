import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import AdminSidebar from '../../components/AdminSidebar'
import {
    Users,
    Shield,
    User,
    Briefcase,
    Check,
    AlertTriangle,
    ChevronLeft
} from '../../components/icons'

const ROLE_NAMES = {
    system_admin: '系統管理員',
    platform_manager: '平台管理者',
    backend_user: '後台使用者',
    user: '前台使用者'
}

const ROLE_COLORS = {
    system_admin: { bg: '#fef3c7', color: '#92400e', border: '#fbbf24' },
    platform_manager: { bg: '#dbeafe', color: '#1e40af', border: '#60a5fa' },
    backend_user: { bg: '#dcfce7', color: '#166534', border: '#4ade80' },
    user: { bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db' }
}

const PERMISSION_LABELS = {
    manage_modes: '分析模式管理',
    manage_roles: '分析角色管理',
    view_results: '查看分析結果',
    manage_users: '權限管理'
}

const GRADE_LABELS = {
    freshman: '大一', sophomore: '大二', junior: '大三', senior: '大四',
    master1: '碩一', master2: '碩二', phd: '博士'
}

export default function AdminUsersPage() {
    const router = useRouter()

    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [authChecking, setAuthChecking] = useState(true)
    const [currentUserId, setCurrentUserId] = useState(null)
    const [currentUserRole, setCurrentUserRole] = useState(null)
    const [currentPermissions, setCurrentPermissions] = useState({})
    const [userName, setUserName] = useState('')

    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)

    // Expanded user details
    const [expandedUserId, setExpandedUserId] = useState(null)

    // Quota edit state
    const [editingQuota, setEditingQuota] = useState(null)
    const [quotaValue, setQuotaValue] = useState('')
    const [savingQuota, setSavingQuota] = useState(false)

    // Role change state
    const [changingRole, setChangingRole] = useState(null)

    // Permission toggle state
    const [savingPerms, setSavingPerms] = useState(null)

    // Password reset state
    const [resettingPassword, setResettingPassword] = useState(null)

    useEffect(() => {
        const checkAuth = async () => {
            const userId = localStorage.getItem('userId')
            if (!userId) {
                router.push('/login?returnUrl=' + encodeURIComponent(router.asPath))
                return
            }

            try {
                const res = await fetch('/api/admin/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId })
                })
                const data = await res.json()

                if (data.hasAdminAccess && data.permissions?.manage_users) {
                    setIsAuthenticated(true)
                    setCurrentUserId(userId)
                    setCurrentUserRole(data.role)
                    setCurrentPermissions(data.permissions || {})
                    setUserName(localStorage.getItem('userName') || '')
                    localStorage.setItem('adminAuth', 'true')
                } else {
                    setError('您沒有權限管理的權限')
                    setTimeout(() => router.push('/dashboard'), 2000)
                }
            } catch (err) {
                setError('驗證失敗')
            } finally {
                setAuthChecking(false)
            }
        }
        checkAuth()
    }, [])

    useEffect(() => {
        if (isAuthenticated) fetchUsers()
    }, [isAuthenticated])

    async function fetchUsers() {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/users?includeUsage=true')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setUsers(data.users || [])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // --- Role change ---
    async function handleRoleChange(userId, newRole) {
        setChangingRole(userId)
        setError(null)
        try {
            const res = await fetch('/api/admin/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminId: currentUserId, userId, newRole })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setSuccess(data.message)
            fetchUsers()
        } catch (err) {
            setError(err.message)
        } finally {
            setChangingRole(null)
        }
    }

    // --- Permission toggle ---
    async function handlePermissionToggle(userId, currentPerms, permKey) {
        setSavingPerms(userId + '_' + permKey)
        setError(null)
        const updated = { ...currentPerms, [permKey]: !currentPerms[permKey] }

        // platform_manager: exclude manage_users from payload to avoid API rejection
        if (currentUserRole === 'platform_manager') {
            delete updated.manage_users
        }

        try {
            const res = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminId: currentUserId, userId, permissions: updated })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setSuccess(data.message)
            fetchUsers()
        } catch (err) {
            setError(err.message)
        } finally {
            setSavingPerms(null)
        }
    }

    // --- Password Reset ---
    async function handleResetPassword(userId, userName) {
        if (!confirm(`確定要重設「${userName}」的密碼嗎？\n系統會產生一組臨時密碼，該使用者下次登入時須自行變更密碼。`)) {
            return
        }
        setResettingPassword(userId)
        setError(null)
        try {
            const res = await fetch('/api/admin/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminId: currentUserId, userId })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setSuccess(data.message)
            // 臨時密碼只會出現這一次；用 prompt 顯示，不會自動消失，也方便複製
            window.prompt(`「${userName}」的臨時密碼（只會顯示這一次，請複製後交給使用者）：`, data.tempPassword)
        } catch (err) {
            setError(err.message)
        } finally {
            setResettingPassword(null)
        }
    }

    // --- Quota ---
    function startEditQuota(user) {
        setEditingQuota(user.id)
        setQuotaValue(String(user.daily_analysis_quota ?? 3))
    }

    async function saveQuota(userId) {
        setSavingQuota(true)
        setError(null)
        try {
            const res = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    adminId: currentUserId,
                    userId,
                    dailyAnalysisQuota: parseInt(quotaValue)
                })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setSuccess(data.message)
            setEditingQuota(null)
            fetchUsers()
        } catch (err) {
            setError(err.message)
        } finally {
            setSavingQuota(false)
        }
    }

    // --- Expand/collapse user detail ---
    function toggleExpand(userId) {
        setExpandedUserId(expandedUserId === userId ? null : userId)
    }

    // --- Available roles for dropdown ---
    function getAssignableRoles() {
        if (currentUserRole === 'system_admin') {
            return ['system_admin', 'platform_manager', 'backend_user', 'user']
        }
        if (currentUserRole === 'platform_manager') {
            return ['backend_user', 'user']
        }
        return []
    }

    // Can current user edit this user's role?
    function canEditUser(user) {
        if (user.id === currentUserId) return false
        if (currentUserRole === 'system_admin') return true
        if (currentUserRole === 'platform_manager') {
            return ['backend_user', 'user'].includes(user.role)
        }
        return false
    }

    // --- Render user detail panel ---
    function renderUserDetail(user) {
        const isStudent = user.occupation === 'student'
        return (
            <tr key={user.id + '_detail'}>
                <td colSpan={6} style={styles.detailCell}>
                    <div style={styles.detailPanel}>
                        <div style={styles.detailGrid}>
                            {/* Basic Info */}
                            <div style={styles.detailSection}>
                                <h4 style={styles.detailSectionTitle}>基本資料</h4>
                                <div style={styles.detailItem}>
                                    <span style={styles.detailLabel}>身份</span>
                                    <span>{user.occupation === 'student' ? '學生' : user.occupation || '未填寫'}</span>
                                </div>
                                {user.age && (
                                    <div style={styles.detailItem}>
                                        <span style={styles.detailLabel}>年齡</span>
                                        <span>{user.age}</span>
                                    </div>
                                )}
                                {user.email && (
                                    <div style={styles.detailItem}>
                                        <span style={styles.detailLabel}>Email</span>
                                        <span>{user.email}</span>
                                    </div>
                                )}
                            </div>

                            {/* Student or Professional Info */}
                            {isStudent ? (
                                <div style={styles.detailSection}>
                                    <h4 style={styles.detailSectionTitle}>學生資料</h4>
                                    {user.school && (
                                        <div style={styles.detailItem}>
                                            <span style={styles.detailLabel}>學校</span>
                                            <span>{user.school}</span>
                                        </div>
                                    )}
                                    {user.department && (
                                        <div style={styles.detailItem}>
                                            <span style={styles.detailLabel}>科系</span>
                                            <span>{user.department}</span>
                                        </div>
                                    )}
                                    {user.major && (
                                        <div style={styles.detailItem}>
                                            <span style={styles.detailLabel}>主修</span>
                                            <span>{user.major}</span>
                                        </div>
                                    )}
                                    {user.grade && (
                                        <div style={styles.detailItem}>
                                            <span style={styles.detailLabel}>年級</span>
                                            <span>{GRADE_LABELS[user.grade] || user.grade}</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={styles.detailSection}>
                                    <h4 style={styles.detailSectionTitle}>職業資料</h4>
                                    {user.industry && (
                                        <div style={styles.detailItem}>
                                            <span style={styles.detailLabel}>產業</span>
                                            <span>{user.industry}</span>
                                        </div>
                                    )}
                                    {user.position && (
                                        <div style={styles.detailItem}>
                                            <span style={styles.detailLabel}>職位</span>
                                            <span>{user.position}</span>
                                        </div>
                                    )}
                                    {user.highest_education_school && (
                                        <div style={styles.detailItem}>
                                            <span style={styles.detailLabel}>最高學歷</span>
                                            <span>
                                                {[user.highest_education_school, user.highest_education_department, user.highest_education_major]
                                                    .filter(Boolean).join(' / ')}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Permissions section for backend_user */}
                            {user.role === 'backend_user' && (
                                <div style={styles.detailSection}>
                                    <h4 style={styles.detailSectionTitle}>功能授權</h4>
                                    {Object.entries(PERMISSION_LABELS).map(([key, label]) => {
                                        const enabled = !!user.permissions?.[key]
                                        const isSaving = savingPerms === user.id + '_' + key
                                        const canToggle = canEditUser(user) &&
                                            !(currentUserRole === 'platform_manager' && key === 'manage_users')

                                        return (
                                            <div key={key} style={styles.permRow}>
                                                <span style={styles.permLabel}>{label}</span>
                                                <button
                                                    onClick={() => canToggle && handlePermissionToggle(user.id, user.permissions || {}, key)}
                                                    disabled={isSaving || !canToggle}
                                                    style={{
                                                        ...styles.toggleBtn,
                                                        ...(enabled ? styles.toggleOn : styles.toggleOff),
                                                        opacity: canToggle ? 1 : 0.5,
                                                        cursor: canToggle ? 'pointer' : 'default'
                                                    }}
                                                >
                                                    {isSaving ? '...' : enabled ? '已開啟' : '未開啟'}
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </td>
            </tr>
        )
    }

    // --- Clear messages after timeout ---
    useEffect(() => {
        if (success) {
            const t = setTimeout(() => setSuccess(null), 3000)
            return () => clearTimeout(t)
        }
    }, [success])

    useEffect(() => {
        if (error) {
            const t = setTimeout(() => setError(null), 5000)
            return () => clearTimeout(t)
        }
    }, [error])

    if (authChecking) {
        return <div style={styles.authLoading}><span>驗證權限中...</span></div>
    }
    if (!isAuthenticated) {
        return <div style={styles.authLoading}><span>{error || '驗證中...'}</span></div>
    }

    return (
        <div style={styles.pageWrapper}>
            <AdminSidebar
                isAdmin={currentUserRole === 'system_admin'}
                currentPath="/admin/users"
                userName={userName}
                permissions={currentPermissions}
            />

            <main style={styles.container}>
                <header style={styles.header}>
                    <div style={styles.headerLeft}>
                        <div style={styles.headerTitleGroup}>
                            <Shield size={24} color="#1a1a2e" />
                            <h1 style={styles.title}>使用者權限管理</h1>
                        </div>
                    </div>
                </header>

                <div style={styles.body}>
                    {error && <div style={styles.error}>{error}</div>}
                    {success && <div style={styles.successMsg}>{success}</div>}

                    <div style={styles.infoBox}>
                        <p>💡 點擊使用者列可展開查看詳細資料。角色說明：系統管理員（全部權限）、平台管理者（可授權功能）、後台使用者（按授權使用）、前台使用者（僅分析房間）</p>
                    </div>

                    {loading ? (
                        <div style={styles.loading}>載入中...</div>
                    ) : (
                        <div style={styles.tableContainer}>
                            <table style={styles.table}>
                                <thead>
                                    <tr style={styles.tableHeaderRow}>
                                        <th style={styles.th}>名稱</th>
                                        <th style={styles.th}>學號/帳號</th>
                                        <th style={styles.th}>角色</th>
                                        <th style={styles.th}>每日額度</th>
                                        <th style={styles.th}>註冊時間</th>
                                        <th style={styles.th}>操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(user => {
                                        const isExpanded = expandedUserId === user.id
                                        const roleColor = ROLE_COLORS[user.role] || ROLE_COLORS.user
                                        const assignableRoles = getAssignableRoles()

                                        return [
                                            <tr
                                                key={user.id}
                                                style={{
                                                    ...styles.tableRow,
                                                    ...(isExpanded ? styles.tableRowExpanded : {}),
                                                    cursor: 'pointer'
                                                }}
                                                onClick={() => toggleExpand(user.id)}
                                            >
                                                <td style={styles.td}>
                                                    <div style={styles.userInfo}>
                                                        <span style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</span>
                                                        <strong>{user.name}</strong>
                                                        {user.id === currentUserId && (
                                                            <span style={styles.youBadge}>（你）</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={styles.td}>
                                                    {user.student_id ? (
                                                        <span style={styles.studentIdBadge}>{user.student_id}</span>
                                                    ) : user.email ? (
                                                        <span style={styles.emailBadge}>{user.email}</span>
                                                    ) : (
                                                        <span style={styles.noId}>—</span>
                                                    )}
                                                </td>
                                                <td style={styles.td} onClick={e => e.stopPropagation()}>
                                                    {canEditUser(user) ? (
                                                        <select
                                                            value={user.role}
                                                            onChange={e => handleRoleChange(user.id, e.target.value)}
                                                            disabled={changingRole === user.id}
                                                            style={{
                                                                ...styles.roleSelect,
                                                                background: roleColor.bg,
                                                                color: roleColor.color,
                                                                borderColor: roleColor.border
                                                            }}
                                                        >
                                                            {/* Always show current role */}
                                                            {!assignableRoles.includes(user.role) && (
                                                                <option value={user.role}>{ROLE_NAMES[user.role]}</option>
                                                            )}
                                                            {assignableRoles.map(r => (
                                                                <option key={r} value={r}>{ROLE_NAMES[r]}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <span style={{
                                                            ...styles.roleBadge,
                                                            background: roleColor.bg,
                                                            color: roleColor.color,
                                                            borderColor: roleColor.border
                                                        }}>
                                                            {ROLE_NAMES[user.role] || user.role}
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={styles.td} onClick={e => e.stopPropagation()}>
                                                    {user.role === 'system_admin' ? (
                                                        <span style={styles.unlimitedBadge}>無限</span>
                                                    ) : editingQuota === user.id ? (
                                                        <div style={styles.quotaEditRow}>
                                                            <input
                                                                type="number" min="0" max="999"
                                                                value={quotaValue}
                                                                onChange={e => setQuotaValue(e.target.value)}
                                                                style={styles.quotaInput}
                                                                autoFocus
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') saveQuota(user.id)
                                                                    if (e.key === 'Escape') setEditingQuota(null)
                                                                }}
                                                            />
                                                            <button
                                                                onClick={() => saveQuota(user.id)}
                                                                style={styles.quotaSaveBtn}
                                                                disabled={savingQuota}
                                                            >
                                                                <Check size={14} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span
                                                            style={styles.quotaDisplay}
                                                            onClick={() => startEditQuota(user)}
                                                            title="點擊編輯"
                                                        >
                                                            {user.used_today !== undefined
                                                                ? `${user.used_today}/${user.daily_analysis_quota ?? 3}`
                                                                : `${user.daily_analysis_quota ?? 3} 次/天`
                                                            }
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={styles.td}>
                                                    {new Date(user.created_at).toLocaleDateString('zh-TW')}
                                                </td>
                                                <td style={{ ...styles.td, display: 'flex', gap: 6, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                                                    {canEditUser(user) && user.role !== 'user' && (
                                                        <button
                                                            onClick={() => handleRoleChange(user.id, 'user')}
                                                            style={styles.revokeButton}
                                                            disabled={changingRole === user.id}
                                                        >
                                                            撤銷權限
                                                        </button>
                                                    )}
                                                    {canEditUser(user) && (
                                                        <button
                                                            onClick={() => handleResetPassword(user.id, user.name)}
                                                            style={styles.resetButton}
                                                            disabled={resettingPassword === user.id}
                                                        >
                                                            {resettingPassword === user.id ? '重設中...' : '重設密碼'}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>,
                                            isExpanded && renderUserDetail(user)
                                        ]
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}

const styles = {
    pageWrapper: { display: 'flex', minHeight: '100vh' },
    authLoading: {
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #fef5e7 0%, #fff5f5 50%, #f0fdf4 100%)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: 18, color: '#6b7280'
    },
    container: {
        flex: 1, marginLeft: 64,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: 'linear-gradient(135deg, #fef5e7 0%, #fff5f5 50%, #f0fdf4 100%)',
        minHeight: '100vh', transition: 'margin-left 0.2s ease'
    },
    header: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 40px', background: '#fff',
        borderBottom: '3px solid #1a1a2e', boxShadow: '0 4px 0 #e5e7eb'
    },
    headerLeft: { display: 'flex', alignItems: 'center', gap: 16 },
    headerTitleGroup: { display: 'flex', alignItems: 'center', gap: 12 },
    title: { fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: 0 },
    body: { padding: '32px 40px', maxWidth: 1200, margin: '0 auto' },
    error: { padding: 12, background: '#fee2e2', color: '#dc2626', borderRadius: 8, marginBottom: 16 },
    successMsg: { padding: 12, background: '#dcfce7', color: '#16a34a', borderRadius: 8, marginBottom: 16 },
    infoBox: {
        padding: 16, background: '#eff6ff', border: '2px solid #bfdbfe',
        borderRadius: 10, marginBottom: 24, fontSize: 14, color: '#1e40af'
    },
    loading: { textAlign: 'center', padding: 60, color: '#6b7280' },
    tableContainer: { background: '#fff', borderRadius: 12, overflow: 'hidden', border: '2px solid #e5e7eb' },
    table: { width: '100%', borderCollapse: 'collapse' },
    tableHeaderRow: { background: '#f9fafb', borderBottom: '2px solid #e5e7eb' },
    th: { padding: '14px 16px', fontSize: 13, fontWeight: 600, color: '#6b7280', textAlign: 'left' },
    tableRow: { borderBottom: '1px solid #f3f4f6', transition: 'background 0.15s' },
    tableRowExpanded: { background: '#f9fafb' },
    td: { padding: '14px 16px', fontSize: 14, color: '#374151' },
    userInfo: { display: 'flex', alignItems: 'center', gap: 8 },
    expandIcon: { fontSize: 10, color: '#9ca3af', width: 16 },
    youBadge: { color: '#6b7280', fontSize: 12, marginLeft: 4 },
    studentIdBadge: {
        display: 'inline-block', padding: '4px 10px', fontSize: 12,
        background: '#eff6ff', color: '#1e40af', borderRadius: 6,
        fontFamily: 'monospace', fontWeight: 600
    },
    emailBadge: {
        display: 'inline-block', padding: '4px 10px', fontSize: 12,
        background: '#f3f4f6', color: '#374151', borderRadius: 6
    },
    noId: { color: '#d1d5db' },
    roleSelect: {
        padding: '5px 8px', fontSize: 12, fontWeight: 600,
        border: '2px solid', borderRadius: 6, cursor: 'pointer', outline: 'none'
    },
    roleBadge: {
        display: 'inline-block', padding: '4px 10px', fontSize: 12,
        border: '1px solid', borderRadius: 6, fontWeight: 600
    },
    unlimitedBadge: {
        display: 'inline-block', padding: '4px 10px', fontSize: 12,
        background: '#f0fdf4', color: '#16a34a', borderRadius: 6, fontWeight: 600
    },
    quotaDisplay: {
        display: 'inline-block', padding: '4px 10px', fontSize: 13,
        background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6,
        cursor: 'pointer', fontWeight: 500
    },
    quotaEditRow: { display: 'flex', alignItems: 'center', gap: 6 },
    quotaInput: {
        width: 60, padding: '6px 8px', fontSize: 13,
        border: '2px solid #4361ee', borderRadius: 6, outline: 'none', textAlign: 'center'
    },
    quotaSaveBtn: {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 28, height: 28, background: '#10b981', color: '#fff',
        border: 'none', borderRadius: 6, cursor: 'pointer'
    },
    revokeButton: {
        padding: '6px 12px', fontSize: 13, background: '#fff', color: '#dc2626',
        border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer'
    },
    resetButton: {
        padding: '6px 12px', fontSize: 13, background: '#fff', color: '#f59e0b',
        border: '1px solid #fde68a', borderRadius: 6, cursor: 'pointer'
    },
    // Detail panel styles
    detailCell: { padding: 0, background: '#fafbfc' },
    detailPanel: {
        padding: '16px 32px 20px', borderBottom: '2px solid #e5e7eb',
        borderTop: '1px solid #e5e7eb'
    },
    detailGrid: {
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: 24
    },
    detailSection: {},
    detailSectionTitle: {
        fontSize: 13, fontWeight: 700, color: '#1a1a2e',
        marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #e5e7eb'
    },
    detailItem: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '4px 0', fontSize: 13
    },
    detailLabel: { color: '#6b7280', fontWeight: 500 },
    // Permission toggle styles
    permRow: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 0'
    },
    permLabel: { fontSize: 13, color: '#374151' },
    toggleBtn: {
        padding: '4px 12px', fontSize: 12, fontWeight: 600,
        border: '1px solid', borderRadius: 20, transition: 'all 0.15s'
    },
    toggleOn: {
        background: '#dcfce7', color: '#16a34a', borderColor: '#86efac'
    },
    toggleOff: {
        background: '#f3f4f6', color: '#9ca3af', borderColor: '#d1d5db'
    }
}
