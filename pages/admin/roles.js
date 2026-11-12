import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import AdminSidebar from '../../components/AdminSidebar'
import { adminStyles } from '../../styles/adminStyles'
import {
    Users,
    Plus,
    Edit,
    Trash2
} from '../../components/icons'

export default function RolesAdminPage() {
    const router = useRouter()

    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [authChecking, setAuthChecking] = useState(true)
    const [userName, setUserName] = useState('')
    const [isAdmin, setIsAdmin] = useState(false)
    const [permissions, setPermissions] = useState({})

    const [roles, setRoles] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)

    // Modal state
    const [showModal, setShowModal] = useState(false)
    const [editingRole, setEditingRole] = useState(null)
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        system_prompt: ''
    })
    const [saving, setSaving] = useState(false)

    // Check authentication on mount
    useEffect(() => {
        const adminAuth = localStorage.getItem('adminAuth')
        const storedUserName = localStorage.getItem('userName')
        const storedIsAdmin = localStorage.getItem('isAdmin')
        const storedPerms = localStorage.getItem('userPermissions')
        if (adminAuth === 'true') {
            setIsAuthenticated(true)
            setUserName(storedUserName || '')
            setIsAdmin(storedIsAdmin === 'true')
            try { setPermissions(JSON.parse(storedPerms || '{}')) } catch (e) { setPermissions({}) }
            setAuthChecking(false)
        } else {
            router.push('/admin/login?returnUrl=' + encodeURIComponent(router.asPath))
        }
    }, [])

    // Fetch all roles on mount (only if authenticated)
    useEffect(() => {
        if (isAuthenticated) {
            fetchRoles()
        }
    }, [isAuthenticated])

    async function fetchRoles() {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/roles')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to fetch')
            setRoles(data.roles || [])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    function openCreateModal() {
        setEditingRole(null)
        setFormData({
            name: '',
            description: '',
            system_prompt: ''
        })
        setShowModal(true)
    }

    function openEditModal(role) {
        setEditingRole(role)
        setFormData({
            name: role.name || '',
            description: role.description || '',
            system_prompt: role.system_prompt || ''
        })
        setShowModal(true)
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!formData.name.trim()) {
            setError('請輸入角色名稱')
            return
        }
        if (!formData.system_prompt.trim()) {
            setError('請輸入 System Prompt')
            return
        }
        // Removed project_id validation - roles are now global


        setSaving(true)
        setError(null)

        try {
            const roleData = {
                name: formData.name.trim(),
                description: formData.description.trim() || null,
                system_prompt: formData.system_prompt.trim()
            }

            if (editingRole) {
                roleData.id = editingRole.id
            }

            const res = await fetch('/api/roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'role',
                    data: roleData
                })
            })
            const result = await res.json()
            if (!res.ok) throw new Error(result.error || 'Failed to save')

            setSuccess(editingRole ? '角色已更新' : '角色已建立')
            setShowModal(false)
            fetchRoles()
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(role) {
        if (!confirm(`確定要刪除角色「${role.name}」嗎？使用此角色的步驟將會失去角色設定。`)) {
            return
        }

        try {
            const res = await fetch('/api/roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'delete_role',
                    data: { id: role.id }
                })
            })
            const result = await res.json()
            if (!res.ok) throw new Error(result.error || 'Failed to delete')
            setSuccess('角色已刪除')
            fetchRoles()
        } catch (err) {
            setError(err.message)
        }
    }

    const handleLogout = () => {
        localStorage.removeItem('adminAuth')
        localStorage.removeItem('adminAuthTime')
        router.push('/admin/login')
    }

    // Show loading while checking auth
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
                currentPath="/admin/roles"
                userName={userName}
                permissions={permissions}
            />

            <main style={styles.container}>
                {/* Header */}
                <header style={styles.header}>
                    <div style={styles.headerLeft}>
                        <Users size={28} color="#1a1a2e" style={{ marginRight: 10 }} />
                        <h1 style={styles.title}>AI 角色管理</h1>
                    </div>
                    <div style={styles.headerRight}>
                        <button onClick={openCreateModal} style={styles.addButton}>
                            <Plus size={16} style={{ marginRight: 6 }} />
                            新增 AI 角色
                        </button>
                    </div>
                </header>

                <div style={styles.body}>
                    {error && <div style={styles.error}>{error}</div>}
                    {success && <div style={styles.success}>{success}</div>}

                    {/* Roles Grid */}
                    {loading && <div style={styles.loading}>載入角色中...</div>}

                    {!loading && roles.length > 0 && (
                        <div style={styles.rolesGrid}>
                            {roles.map(role => (
                                <div key={role.id} style={styles.roleCard}>
                                    <div style={styles.cardHeader}>
                                        <h3 style={styles.roleName}>{role.name}</h3>
                                    </div>
                                    {role.description && (
                                        <p style={styles.roleDesc}>{role.description}</p>
                                    )}
                                    <div style={styles.promptPreview}>
                                        <label style={styles.promptLabel}>System Prompt:</label>
                                        <pre style={styles.promptContent}>
                                            {role.system_prompt}
                                        </pre>
                                    </div>
                                    <div style={styles.cardActions}>
                                        <button
                                            onClick={() => openEditModal(role)}
                                            style={styles.editButton}
                                        >
                                            <Edit size={14} style={{ marginRight: 4 }} />
                                            編輯
                                        </button>
                                        <button
                                            onClick={() => handleDelete(role)}
                                            style={styles.deleteButton}
                                        >
                                            <Trash2 size={14} style={{ marginRight: 4 }} />
                                            刪除
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {!loading && roles.length === 0 && (
                        <div style={styles.empty}>
                            <p>尚無 AI 角色</p>
                            <p style={styles.emptyHint}>請先在分析模式中建立角色</p>
                        </div>
                    )}
                </div>

                {/* Create/Edit Modal */}
                {showModal && (
                    <div style={styles.modalOverlay} onClick={() => setShowModal(false)}>
                        <div style={styles.modal} onClick={e => e.stopPropagation()}>
                            <h2 style={styles.modalTitle}>
                                {editingRole ? '編輯角色' : '新增角色'}
                            </h2>
                            <form onSubmit={handleSubmit}>
                                <div style={styles.formGroup}>
                                    <label style={styles.formLabel}>角色名稱 *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="例如：質性研究專家"
                                        style={styles.input}
                                        autoFocus
                                    />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.formLabel}>角色描述 (選填)</label>
                                    <input
                                        type="text"
                                        value={formData.description}
                                        onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                        placeholder="簡述此角色的用途"
                                        style={styles.input}
                                    />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.formLabel}>System Prompt *</label>
                                    <textarea
                                        value={formData.system_prompt}
                                        onChange={e => setFormData(prev => ({ ...prev, system_prompt: e.target.value }))}
                                        placeholder="你是一位具備二十年質性研究實務經驗，專精於 Brand Strategy 質性資料分析的專家..."
                                        style={styles.textarea}
                                        rows={8}
                                    />
                                    <p style={styles.hint}>
                                        這是 AI 的角色設定，會作為 System Prompt 傳給 LLM
                                    </p>
                                </div>
                                <div style={styles.modalActions}>
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        style={styles.cancelButton}
                                    >
                                        取消
                                    </button>
                                    <button
                                        type="submit"
                                        style={styles.addButton}
                                        disabled={saving}
                                    >
                                        {saving ? '儲存中...' : (editingRole ? '更新角色' : '建立角色')}
                                    </button>
                                </div>
                            </form>
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
        padding: '0',
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
    headerRight: {
        display: 'flex',
        alignItems: 'center',
        gap: 16
    },
    title: {
        fontSize: 22,
        fontWeight: 700,
        color: '#1a1a2e',
        margin: 0
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
        padding: 14,
        background: '#fee2e2',
        color: '#dc2626',
        borderRadius: 8,
        marginBottom: 16,
        border: '2px solid #fecaca'
    },
    success: {
        padding: 16,
        background: '#d1fae5',
        color: '#065f46',
        borderRadius: 8,
        marginBottom: 20,
        border: '2px solid #6ee7b7'
    },
    loading: {
        textAlign: 'center',
        padding: 40,
        fontSize: 16,
        color: '#6b7280'
    },
    rolesGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 24,
        marginTop: 24
    },
    roleCard: {
        background: '#fff',
        borderRadius: 16,
        border: '2px solid #e5e7eb',
        padding: 24,
        transition: 'border-color 0.2s, box-shadow 0.2s',
        display: 'flex',
        flexDirection: 'column',
        gap: 16
    },
    cardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12
    },
    roleName: {
        fontSize: 18,
        fontWeight: 600,
        color: '#1a1a2e',
        margin: 0,
        flex: 1
    },
    projectBadge: {
        padding: '4px 12px',
        background: '#e0e7ff',
        color: '#4338ca',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 500,
        whiteSpace: 'nowrap'
    },
    roleDesc: {
        fontSize: 14,
        color: '#6b7280',
        margin: 0,
        lineHeight: 1.5
    },
    promptPreview: {
        flex: 1
    },
    promptLabel: {
        display: 'block',
        fontSize: 12,
        fontWeight: 600,
        color: '#6b7280',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
    },
    promptContent: {
        background: '#f9fafb',
        padding: 12,
        borderRadius: 8,
        fontSize: 13,
        color: '#374151',
        lineHeight: 1.6,
        maxHeight: 120,
        overflow: 'auto',
        margin: 0,
        fontFamily: 'monospace',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
    },
    cardActions: {
        display: 'flex',
        gap: 12,
        marginTop: 'auto'
    },
    editButton: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px 16px',
        fontSize: 14,
        background: '#fef3c7',
        color: '#92400e',
        border: '2px solid #fbbf24',
        borderRadius: 8,
        cursor: 'pointer',
        fontWeight: 600
    },
    deleteButton: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px 16px',
        fontSize: 14,
        background: '#fee2e2',
        color: '#991b1b',
        border: '2px solid #ef4444',
        borderRadius: 8,
        cursor: 'pointer',
        fontWeight: 600
    },
    empty: {
        textAlign: 'center',
        padding: 60,
        color: '#9ca3af',
        fontSize: 16
    },
    emptyHint: {
        fontSize: 14,
        color: '#d1d5db',
        marginTop: 8
    },
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
    },
    modal: {
        background: '#fff',
        borderRadius: 16,
        padding: 32,
        maxWidth: 600,
        width: '90%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 700,
        color: '#1a1a2e',
        marginBottom: 24
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
        padding: '10px 12px',
        fontSize: 14,
        border: '2px solid #e5e7eb',
        borderRadius: 8,
        fontFamily: 'inherit',
        boxSizing: 'border-box'
    },
    textarea: {
        width: '100%',
        padding: '10px 12px',
        fontSize: 14,
        border: '2px solid #e5e7eb',
        borderRadius: 8,
        fontFamily: 'inherit',
        resize: 'vertical',
        boxSizing: 'border-box'
    },
    hint: {
        fontSize: 12,
        color: '#9ca3af',
        marginTop: 6,
        fontStyle: 'italic'
    },
    modalActions: {
        display: 'flex',
        gap: 12,
        marginTop: 24
    },
    cancelButton: {
        flex: 1,
        padding: '12px 24px',
        fontSize: 14,
        background: '#f3f4f6',
        color: '#374151',
        border: '2px solid #e5e7eb',
        borderRadius: 8,
        cursor: 'pointer',
        fontWeight: 600
    },
    addButton: {
        flex: 1,
        padding: '12px 24px',
        fontSize: 14,
        background: '#10b981',
        color: '#fff',
        border: '2px solid #059669',
        borderRadius: 8,
        cursor: 'pointer',
        fontWeight: 600
    }
}
