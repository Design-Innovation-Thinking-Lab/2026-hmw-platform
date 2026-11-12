import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import AdminSidebar from '../../components/AdminSidebar'
import { adminStyles } from '../../styles/adminStyles'
import {
    Settings,
    Plus,
    Star,
    BarChart,
    Calendar,
    Edit,
    Trash2,
    AlertTriangle
} from '../../components/icons'

export default function AdminIndexPage() {
    const router = useRouter()

    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [authChecking, setAuthChecking] = useState(true)
    const [userId, setUserId] = useState(null)
    const [userName, setUserName] = useState('')
    const [isAdmin, setIsAdmin] = useState(false)
    const [userRole, setUserRole] = useState('user')
    const [permissions, setPermissions] = useState({})

    const [projects, setProjects] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)

    // Delete confirmation modal
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [projectToDelete, setProjectToDelete] = useState(null)
    const [deleting, setDeleting] = useState(false)

    // New project modal
    const [showNewModal, setShowNewModal] = useState(false)
    const [newName, setNewName] = useState('')
    const [newDesc, setNewDesc] = useState('')
    const [creating, setCreating] = useState(false)

    // Default toggle
    const [togglingDefault, setTogglingDefault] = useState(null)

    // Check authentication on mount
    useEffect(() => {
        const adminAuth = localStorage.getItem('adminAuth')
        const storedUserId = localStorage.getItem('userId')
        const storedUserName = localStorage.getItem('userName')
        const storedIsAdmin = localStorage.getItem('isAdmin')
        const storedPerms = localStorage.getItem('userPermissions')

        if (adminAuth === 'true') {
            setIsAuthenticated(true)
            setUserId(storedUserId)
            setUserName(storedUserName || '')
            setIsAdmin(storedIsAdmin === 'true')
            setUserRole(localStorage.getItem('userRole') || 'user')
            try { setPermissions(JSON.parse(storedPerms || '{}')) } catch (e) { setPermissions({}) }
            setAuthChecking(false)
        } else {
            router.push('/admin/login?returnUrl=' + encodeURIComponent(router.asPath))
        }
    }, [])

    // Fetch projects
    useEffect(() => {
        if (isAuthenticated && userId) {
            fetchProjects()
        }
    }, [isAuthenticated, userId])

    async function fetchProjects() {
        setLoading(true)
        try {
            const res = await fetch(`/api/projects?isAdmin=true&userId=${userId}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setProjects(data.projects || [])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    async function handleCreate(e) {
        e.preventDefault()
        if (!newName.trim()) {
            setError('請輸入分析模式名稱')
            return
        }

        setCreating(true)
        setError(null)
        try {
            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newName,
                    description: newDesc,
                    userId: userId  // Fixed: changed from createdBy to userId for permission check
                })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            // Update local state so the list stays in sync
            setProjects(prev => [data.project, ...prev])

            setSuccess('分析模式建立成功！')
            setShowNewModal(false)
            setNewName('')
            setNewDesc('')

            // Navigate to edit page
            router.push(`/admin/steps?projectId=${data.project.id}`)
        } catch (err) {
            setError(err.message)
        } finally {
            setCreating(false)
        }
    }

    function handleEdit(projectId) {
        router.push(`/admin/steps?projectId=${projectId}`)
    }

    function handleDeleteClick(project) {
        setProjectToDelete(project)
        setShowDeleteModal(true)
    }

    async function confirmDelete() {
        if (!projectToDelete) return

        setDeleting(true)
        setError(null)
        try {
            const res = await fetch('/api/projects', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: projectToDelete.id,
                    userId: userId
                })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            setSuccess('分析模式已刪除')
            setShowDeleteModal(false)
            setProjectToDelete(null)
            fetchProjects()
        } catch (err) {
            setError(err.message)
        } finally {
            setDeleting(false)
        }
    }

    async function handleToggleDefault(project) {
        setTogglingDefault(project.id)
        setError(null)
        try {
            const res = await fetch('/api/projects', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.id,
                    isDefault: !project.is_default,
                    userId: userId
                })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setSuccess(project.is_default ? '已取消預設模式' : '已設為預設模式')
            fetchProjects()
        } catch (err) {
            setError(err.message)
        } finally {
            setTogglingDefault(null)
        }
    }

    const handleLogout = () => {
        localStorage.removeItem('adminAuth')
        localStorage.removeItem('adminAuthTime')
        router.push('/admin/login')
    }

    if (authChecking || !isAuthenticated) {
        return (
            <div style={styles.authLoading}>
                <span>驗證中...</span>
            </div>
        )
    }

    return (
        <div style={styles.pageWrapper}>
            {/* Sidebar */}
            <AdminSidebar
                isAdmin={isAdmin}
                currentPath="/admin"
                userName={userName}
                permissions={permissions}
            />

            <main style={styles.container}>
                {/* Header */}
                <header style={styles.header}>
                    <div style={styles.headerLeft}>
                        <Settings size={28} color="#1a1a2e" style={{ marginRight: 10 }} />
                        <h1 style={styles.title}>分析模式管理</h1>
                    </div>
                </header>

                <div style={styles.body}>
                    {error && <div style={styles.error}>{error}</div>}
                    {success && <div style={styles.success}>{success}</div>}

                    {loading ? (
                        <div style={styles.loading}>載入中...</div>
                    ) : (
                        <div style={styles.grid}>
                            {/* New Project Card */}
                            <div
                                onClick={() => setShowNewModal(true)}
                                style={styles.addCard}
                            >
                                <Plus size={48} color="#4361ee" style={{ marginBottom: 16 }} />
                                <h3 style={styles.addCardTitle}>建立新分析模式</h3>
                                <p style={styles.addCardHint}>點擊新增分析模式</p>
                            </div>

                            {/* Existing Projects */}
                            {projects.map(project => (
                                <div key={project.id} style={styles.card}>
                                    <div style={styles.cardHeader}>
                                        <h3 style={styles.cardTitle}>{project.name}</h3>
                                        {project.is_default && (
                                            <span style={styles.defaultBadge}>
                                                <Star size={12} fill="#92400e" style={{ marginRight: 4 }} />
                                                預設
                                            </span>
                                        )}
                                    </div>
                                    {project.description && (
                                        <p style={styles.cardDesc}>{project.description}</p>
                                    )}
                                    <div style={styles.cardMeta}>
                                        <span style={{ display: 'flex', alignItems: 'center' }}>
                                            <BarChart size={14} style={{ marginRight: 4 }} />
                                            {project.step_count || 0} 個步驟
                                        </span>
                                        <span style={{ display: 'flex', alignItems: 'center' }}>
                                            <Calendar size={14} style={{ marginRight: 4 }} />
                                            {new Date(project.created_at).toLocaleDateString('zh-TW')}
                                        </span>
                                    </div>
                                    <div style={styles.cardActions}>
                                        <button
                                            onClick={() => handleEdit(project.id)}
                                            style={styles.editButton}
                                        >
                                            <Edit size={14} style={{ marginRight: 6 }} />
                                            編輯步驟
                                        </button>
                                        {userRole === 'system_admin' && (
                                            <button
                                                onClick={() => handleToggleDefault(project)}
                                                style={project.is_default ? styles.unsetDefaultButton : styles.setDefaultButton}
                                                disabled={togglingDefault === project.id}
                                            >
                                                <Star size={14} fill={project.is_default ? '#92400e' : 'none'} style={{ marginRight: 6 }} />
                                                {togglingDefault === project.id ? '處理中...' : project.is_default ? '取消預設' : '設為預設'}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDeleteClick(project)}
                                            style={styles.deleteButton}
                                        >
                                            <Trash2 size={14} style={{ marginRight: 6 }} />
                                            刪除
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* New Project Modal */}
                {showNewModal && (
                    <div style={styles.modalOverlay} onClick={() => setShowNewModal(false)}>
                        <div style={styles.modal} onClick={e => e.stopPropagation()}>
                            <h2 style={styles.modalTitle}>建立新分析模式</h2>
                            <form onSubmit={handleCreate}>
                                <div style={styles.formGroup}>
                                    <label style={styles.formLabel}>分析模式名稱 *</label>
                                    <input
                                        type="text"
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        placeholder="例如：用戶訪談深度分析"
                                        style={styles.input}
                                        autoFocus
                                    />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.formLabel}>描述 (選填)</label>
                                    <textarea
                                        value={newDesc}
                                        onChange={e => setNewDesc(e.target.value)}
                                        placeholder="簡述此分析模式的用途..."
                                        style={styles.textarea}
                                        rows={3}
                                    />
                                </div>
                                <div style={styles.modalActions}>
                                    <button
                                        type="button"
                                        onClick={() => setShowNewModal(false)}
                                        style={styles.cancelButton}
                                    >
                                        取消
                                    </button>
                                    <button
                                        type="submit"
                                        style={styles.submitButton}
                                        disabled={creating}
                                    >
                                        {creating ? '建立中...' : '建立分析模式'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {showDeleteModal && projectToDelete && (
                    <div style={styles.modalOverlay} onClick={() => setShowDeleteModal(false)}>
                        <div style={styles.modal} onClick={e => e.stopPropagation()}>
                            <h2 style={styles.modalTitle}>
                                <AlertTriangle size={24} color="#f59e0b" style={{ marginRight: 10 }} />
                                確認刪除
                            </h2>
                            <p style={styles.deleteWarning}>
                                確定要刪除分析模式「<strong>{projectToDelete.name}</strong>」嗎？
                            </p>
                            <p style={styles.deleteNote}>
                                此操作將會刪除該模式下的所有步驟、角色及分析結果，且無法復原。
                            </p>
                            <div style={styles.modalActions}>
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    style={styles.cancelButton}
                                >
                                    取消
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    style={styles.deleteConfirmButton}
                                    disabled={deleting}
                                >
                                    {deleting ? '刪除中...' : '確認刪除'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}

const styles = {
    pageWrapper: {
        display: 'flex',
        minHeight: '100vh'
    },
    authLoading: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #fef5e7 0%, #fff5f5 50%, #f0fdf4 100%)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: 18,
        color: '#6b7280'
    },
    container: {
        flex: 1,
        marginLeft: 64,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: 'linear-gradient(135deg, #fef5e7 0%, #fff5f5 50%, #f0fdf4 100%)',
        minHeight: '100vh',
        transition: 'margin-left 0.2s ease'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 40px',
        background: '#fff',
        borderBottom: '3px solid #1a1a2e',
        boxShadow: '0 4px 0 #e5e7eb'
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: 12
    },
    headerIcon: {
        // fontSize: 28 // Removed
    },
    title: {
        fontSize: 22,
        fontWeight: 700,
        color: '#1a1a2e',
        margin: 0
    },
    headerRight: {
        display: 'flex',
        alignItems: 'center',
        gap: 16
    },
    navLink: {
        padding: '8px 16px',
        fontSize: 14,
        fontWeight: 500,
        color: '#4361ee',
        textDecoration: 'none',
        background: '#f0f4ff',
        borderRadius: 8,
        border: '2px solid #4361ee',
        display: 'flex',
        alignItems: 'center'
    },
    newButton: {
        display: 'flex',
        alignItems: 'center',
        padding: '10px 20px',
        fontSize: 14,
        background: '#4361ee',
        color: '#fff',
        border: '3px solid #1a1a2e',
        borderRadius: 10,
        cursor: 'pointer',
        fontWeight: 600,
        boxShadow: '3px 3px 0 #1a1a2e'
    },
    logoutButton: {
        display: 'flex',
        alignItems: 'center',
        padding: '10px 16px',
        fontSize: 13,
        background: '#f3f4f6',
        color: '#374151',
        border: '2px solid #e5e7eb',
        borderRadius: 8,
        cursor: 'pointer',
        fontWeight: 500
    },
    body: {
        padding: '32px 40px',
        maxWidth: 1400,
        margin: '0 auto'
    },
    error: {
        padding: 12,
        background: '#fee2e2',
        color: '#dc2626',
        borderRadius: 8,
        marginBottom: 16
    },
    success: {
        padding: 12,
        background: '#dcfce7',
        color: '#16a34a',
        borderRadius: 8,
        marginBottom: 16
    },
    loading: {
        textAlign: 'center',
        padding: 60,
        color: '#6b7280',
        fontSize: 16
    },
    empty: {
        textAlign: 'center',
        padding: 80,
        background: '#fff',
        borderRadius: 16,
        border: '2px dashed #d1d5db'
    },
    emptyText: {
        fontSize: 18,
        color: '#374151',
        marginBottom: 8
    },
    emptyHint: {
        fontSize: 14,
        color: '#6b7280'
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 24
    },
    addCard: {
        background: 'linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%)',
        borderRadius: 16,
        border: '3px dashed #4361ee',
        padding: 40,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s',
        minHeight: 280
    },
    addCardTitle: {
        fontSize: 18,
        fontWeight: 700,
        color: '#4361ee',
        margin: 0,
        marginBottom: 8,
        textAlign: 'center'
    },
    addCardHint: {
        fontSize: 14,
        color: '#6b7280',
        margin: 0,
        textAlign: 'center'
    },
    card: {
        background: '#fff',
        borderRadius: 16,
        border: '2px solid #e5e7eb',
        padding: 24,
        transition: 'border-color 0.2s, box-shadow 0.2s'
    },
    cardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 600,
        color: '#1a1a2e',
        margin: 0
    },
    defaultBadge: {
        display: 'flex',
        alignItems: 'center',
        padding: '4px 10px',
        fontSize: 12,
        background: '#fef3c7',
        color: '#92400e',
        borderRadius: 6,
        fontWeight: 500
    },
    cardDesc: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 16,
        lineHeight: 1.5
    },
    cardMeta: {
        display: 'flex',
        gap: 16,
        fontSize: 13,
        color: '#9ca3af',
        marginBottom: 16
    },
    cardActions: {
        display: 'flex',
        gap: 12,
        borderTop: '1px solid #f3f4f6',
        paddingTop: 16
    },
    editButton: {
        flex: 1,
        padding: '10px 16px',
        fontSize: 14,
        background: '#4361ee',
        color: '#fff',
        border: '2px solid #1a1a2e',
        borderRadius: 8,
        cursor: 'pointer',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    deleteButton: {
        padding: '10px 16px',
        fontSize: 14,
        background: '#fff',
        color: '#dc2626',
        border: '2px solid #fecaca',
        borderRadius: 8,
        cursor: 'pointer',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center'
    },
    modalOverlay: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
    },
    modal: {
        background: '#fff',
        borderRadius: 16,
        padding: 32,
        width: '100%',
        maxWidth: 480,
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 700,
        color: '#1a1a2e',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center'
    },
    formGroup: {
        marginBottom: 20
    },
    formLabel: {
        display: 'block',
        fontSize: 14,
        fontWeight: 600,
        color: '#374151',
        marginBottom: 8
    },
    input: {
        width: '100%',
        padding: '12px 14px',
        fontSize: 15,
        border: '2px solid #e5e7eb',
        borderRadius: 10,
        outline: 'none',
        boxSizing: 'border-box'
    },
    textarea: {
        width: '100%',
        padding: '12px 14px',
        fontSize: 15,
        border: '2px solid #e5e7eb',
        borderRadius: 10,
        outline: 'none',
        resize: 'vertical',
        boxSizing: 'border-box',
        fontFamily: 'inherit'
    },
    modalActions: {
        display: 'flex',
        gap: 12,
        marginTop: 24
    },
    cancelButton: {
        flex: 1,
        padding: '12px 20px',
        fontSize: 14,
        background: '#f3f4f6',
        color: '#374151',
        border: '2px solid #e5e7eb',
        borderRadius: 10,
        cursor: 'pointer',
        fontWeight: 500
    },
    submitButton: {
        flex: 1,
        padding: '12px 20px',
        fontSize: 14,
        background: '#10b981',
        color: '#fff',
        border: '2px solid #1a1a2e',
        borderRadius: 10,
        cursor: 'pointer',
        fontWeight: 600
    },
    deleteWarning: {
        fontSize: 15,
        color: '#374151',
        marginBottom: 12
    },
    deleteNote: {
        fontSize: 13,
        color: '#6b7280',
        background: '#fef2f2',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16
    },
    deleteConfirmButton: {
        flex: 1,
        padding: '12px 20px',
        fontSize: 14,
        background: '#dc2626',
        color: '#fff',
        border: '2px solid #1a1a2e',
        borderRadius: 10,
        cursor: 'pointer',
        fontWeight: 600
    }
}
