import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import AdminSidebar from '../../components/AdminSidebar'
import { adminStyles } from '../../styles/adminStyles'
import { supabase } from '../../lib/supabaseClient'
import {
    ClipboardList,
    Plus,
    Edit,
    Trash2,
    Upload,
    Image as ImageIcon,
    X
} from '../../components/icons'

export default function StepsAdminPage() {
    const router = useRouter()
    const { projectId: queryProjectId } = router.query

    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [authChecking, setAuthChecking] = useState(true)
    const [userId, setUserId] = useState(null)
    const [userName, setUserName] = useState('')
    const [isAdmin, setIsAdmin] = useState(false)
    const [permissions, setPermissions] = useState({})

    const [projects, setProjects] = useState([])
    const [projectId, setProjectId] = useState('')
    const [steps, setSteps] = useState([])
    const [roles, setRoles] = useState([])
    const [loading, setLoading] = useState(false)
    const [loadingProjects, setLoadingProjects] = useState(true)
    const [error, setError] = useState(null)
    const [saving, setSaving] = useState(false)

    // New project modal state
    const [showNewProjectModal, setShowNewProjectModal] = useState(false)
    const [newProjectName, setNewProjectName] = useState('')
    const [newProjectDesc, setNewProjectDesc] = useState('')
    const [creatingProject, setCreatingProject] = useState(false)

    // Step modal state
    const [showStepModal, setShowStepModal] = useState(false)
    const [editingStep, setEditingStep] = useState(null) // null = new, object = editing
    const [stepFormData, setStepFormData] = useState({
        title: '',
        prompt_template: '',
        analysis_scope: 'individual',
        role_id: '',
        is_active: true,
        prompt_image_url: ''
    })
    const [originalStepIndex, setOriginalStepIndex] = useState(null)
    const [attachments, setAttachments] = useState([])
    const [uploadingImage, setUploadingImage] = useState(false)
    const [uploadingAttachment, setUploadingAttachment] = useState(false)

    const dragItem = useRef(null)
    const dragOverItem = useRef(null)

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
            try { setPermissions(JSON.parse(storedPerms || '{}')) } catch (e) { setPermissions({}) }
            setAuthChecking(false)
        } else {
            router.push('/admin/login?returnUrl=' + encodeURIComponent(router.asPath))
        }
    }, [])

    // Fetch projects on mount (only if authenticated)
    useEffect(() => {
        if (isAuthenticated) {
            fetchProjects()
        }
    }, [isAuthenticated])

    // Auto-select project from URL query parameter
    useEffect(() => {
        if (queryProjectId && projects.length > 0 && !projectId) {
            setProjectId(queryProjectId)
        }
    }, [queryProjectId, projects])

    // Auto-fetch steps when projectId is set
    useEffect(() => {
        if (projectId) {
            fetchConfig()
        }
    }, [projectId])

    async function fetchProjects() {
        setLoadingProjects(true)
        try {
            const storedUserId = localStorage.getItem('userId')
            const res = await fetch(`/api/projects${storedUserId ? `?userId=${storedUserId}` : ''}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to fetch projects')
            setProjects(data.projects || [])
        } catch (err) {
            console.error('Error fetching projects:', err)
        } finally {
            setLoadingProjects(false)
        }
    }

    async function fetchConfig() {
        if (!projectId) {
            setError('請選擇分析模式')
            return
        }
        setLoading(true)
        setError(null)
        try {
            const res = await fetch(`/api/analysis/config?projectId=${projectId}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to fetch')
            setSteps(data.steps || [])
            setRoles(data.roles || [])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    async function handleCreateProject(e) {
        e.preventDefault()
        if (!newProjectName.trim()) {
            setError('請輸入分析模式名稱')
            return
        }

        setCreatingProject(true)
        setError(null)
        try {
            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newProjectName,
                    description: newProjectDesc,
                    userId: userId  // Added: include userId for permission check
                })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to create project')

            // Add to list and select
            setProjects(prev => [data.project, ...prev])
            setProjectId(data.project.id)
            setShowNewProjectModal(false)
            setNewProjectName('')
            setNewProjectDesc('')

            // Update URL
            router.push(`/admin/steps?projectId=${data.project.id}`, undefined, { shallow: true })
        } catch (err) {
            setError(err.message)
        } finally {
            setCreatingProject(false)
        }
    }

    // Drag and drop handlers
    function handleDragStart(index) {
        dragItem.current = index
    }

    function handleDragEnter(index) {
        dragOverItem.current = index
    }

    function handleDragEnd() {
        if (dragItem.current === null || dragOverItem.current === null) return
        if (dragItem.current === dragOverItem.current) {
            dragItem.current = null
            dragOverItem.current = null
            return
        }

        const newSteps = [...steps]
        const draggedItem = newSteps[dragItem.current]
        newSteps.splice(dragItem.current, 1)
        newSteps.splice(dragOverItem.current, 0, draggedItem)

        const updatedSteps = newSteps.map((step, idx) => ({
            ...step,
            step_index: idx + 1
        }))

        setSteps(updatedSteps)
        dragItem.current = null
        dragOverItem.current = null
        saveOrder(updatedSteps)
    }

    async function saveOrder(stepsToSave) {
        setSaving(true)
        try {
            const orderedIds = stepsToSave.map(s => s.id)
            const res = await fetch(`/api/analysis/config?projectId=${projectId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'reorder',
                    data: { orderedIds }
                })
            })
            const result = await res.json()
            if (!res.ok) throw new Error(result.error || 'Failed to save')
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(stepId, stepTitle) {
        if (!confirm(`確定要刪除步驟「${stepTitle}」嗎？此操作無法復原。`)) {
            return
        }
        try {
            const res = await fetch(`/api/analysis/config?projectId=${projectId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'delete_step',
                    data: { id: stepId }
                })
            })
            const result = await res.json()
            if (!res.ok) throw new Error(result.error || 'Failed to delete')
            fetchConfig()
        } catch (err) {
            setError(err.message)
        }
    }

    async function handleToggleStatus(step) {
        try {
            // Only send actual DB columns, not joined relations like analysis_roles
            const res = await fetch(`/api/analysis/config?projectId=${projectId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'step',
                    data: {
                        id: step.id,
                        project_id: step.project_id,
                        step_index: step.step_index,
                        title: step.title,
                        prompt_template: step.prompt_template,
                        analysis_scope: step.analysis_scope,
                        role_id: step.role_id,
                        is_active: !step.is_active,
                        prompt_image_url: step.prompt_image_url,
                        updated_at: new Date().toISOString()
                    }
                })
            })
            const result = await res.json()
            if (!res.ok) throw new Error(result.error || 'Failed to update')
            fetchConfig()
        } catch (err) {
            setError(err.message)
        }
    }

    async function handleEdit(step) {
        setEditingStep(step)
        setStepFormData({
            title: step.title || '',
            prompt_template: step.prompt_template || '',
            analysis_scope: step.analysis_scope || 'individual',
            role_id: step.role_id || '',
            is_active: step.is_active !== false,
            prompt_image_url: step.prompt_image_url || ''
        })
        setOriginalStepIndex(step.step_index)
        await fetchAttachments(step.id)
        setShowStepModal(true)
    }

    function handleAdd() {
        if (!projectId) {
            setError('請先選擇分析模式')
            return
        }
        resetStepForm()
        setShowStepModal(true)
    }

    function resetStepForm() {
        setEditingStep(null)
        setStepFormData({
            title: '',
            prompt_template: '',
            analysis_scope: 'individual',
            role_id: '',
            is_active: true,
            prompt_image_url: ''
        })
        setOriginalStepIndex(null)
        setAttachments([])
    }

    function handleCloseStepModal() {
        setShowStepModal(false)
        resetStepForm()
    }

    function handleStepFormChange(field, value) {
        setStepFormData(prev => ({
            ...prev,
            [field]: value
        }))
    }

    async function fetchAttachments(stepId) {
        try {
            const res = await fetch(`/api/analysis/step-attachments?stepId=${stepId}`)
            const data = await res.json()
            if (res.ok) {
                setAttachments(data.attachments || [])
            }
        } catch (err) {
            console.error('Error fetching attachments:', err)
        }
    }

    async function handleImageUpload(e) {
        const file = e.target.files?.[0]
        if (!file) return

        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        if (!validTypes.includes(file.type)) {
            setError('請上傳 JPG、PNG、GIF 或 WebP 格式的圖片')
            return
        }

        if (file.size > 5 * 1024 * 1024) {
            setError('圖片大小不能超過 5MB')
            return
        }

        setUploadingImage(true)
        setError(null)

        try {
            const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'uploads'
            const fileExt = file.name.split('.').pop()
            const fileName = `${projectId}/step-images/${Date.now()}.${fileExt}`

            const { data, error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(fileName, file, { upsert: false })

            if (uploadError) throw uploadError

            const { data: urlData } = supabase.storage
                .from(bucket)
                .getPublicUrl(data.path)

            setStepFormData(prev => ({
                ...prev,
                prompt_image_url: urlData.publicUrl
            }))
        } catch (err) {
            setError('圖片上傳失敗：' + err.message)
        } finally {
            setUploadingImage(false)
        }
    }

    function handleRemoveImage() {
        setStepFormData(prev => ({
            ...prev,
            prompt_image_url: ''
        }))
    }

    async function handleAttachmentUpload(e) {
        const file = e.target.files?.[0]
        if (!file) return

        const validTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf',
            'text/plain',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ]
        if (!validTypes.includes(file.type)) {
            setError('請上傳 JPG、PNG、PDF、TXT 或 DOCX 格式的檔案')
            return
        }

        if (file.size > 3 * 1024 * 1024) {
            setError('檔案大小不能超過 3MB')
            return
        }

        // If no stepId yet, store in state temporarily (will upload after save)
        if (!editingStep || !editingStep.id) {
            // Create a temporary attachment object
            const tempAttachment = {
                id: `temp_${Date.now()}`,
                file_name: file.name,
                file_size: file.size,
                file_type: file.type.startsWith('image/') ? 'image' :
                    file.type === 'application/pdf' ? 'pdf' :
                        file.type.includes('word') ? 'document' : 'reference',
                mime_type: file.type,
                _tempFile: file // Store the actual file for later upload
            }
            setAttachments([...attachments, tempAttachment])
            e.target.value = ''
            return
        }

        setUploadingAttachment(true)
        setError(null)

        try {
            const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'uploads'
            const fileExt = file.name.split('.').pop()
            const fileName = `step-attachments/${editingStep.id}/${Date.now()}.${fileExt}`

            const { data, error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(fileName, file, { upsert: false })

            if (uploadError) throw uploadError

            let fileType = 'reference'
            if (file.type.startsWith('image/')) fileType = 'image'
            else if (file.type === 'application/pdf') fileType = 'pdf'
            else if (file.type.includes('word')) fileType = 'document'

            const res = await fetch('/api/analysis/step-attachments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    stepId: editingStep.id,
                    fileName: file.name,
                    storageUrl: data.path,
                    mimeType: file.type,
                    fileSize: file.size,
                    fileType
                })
            })

            const result = await res.json()
            if (!res.ok) throw new Error(result.error)

            setAttachments([...attachments, result.attachment])
            e.target.value = ''
        } catch (err) {
            setError('附件上傳失敗：' + err.message)
        } finally {
            setUploadingAttachment(false)
        }
    }

    async function handleDeleteAttachment(attachmentId) {
        if (!confirm('確定要刪除這個附件嗎？')) return

        try {
            const res = await fetch('/api/analysis/step-attachments', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ attachmentId })
            })

            const result = await res.json()
            if (!res.ok) throw new Error(result.error)

            setAttachments(attachments.filter(att => att.id !== attachmentId))
        } catch (err) {
            setError('刪除附件失敗：' + err.message)
        }
    }

    async function handleStepFormSubmit(e) {
        e.preventDefault()

        if (!stepFormData.title.trim()) {
            setError('請輸入步驟標題')
            return
        }
        if (!stepFormData.prompt_template.trim()) {
            setError('請輸入 Prompt 模板')
            return
        }

        setSaving(true)
        setError(null)

        try {
            let stepData = {
                project_id: projectId,
                title: stepFormData.title,
                prompt_template: stepFormData.prompt_template,
                analysis_scope: stepFormData.analysis_scope,
                role_id: stepFormData.role_id || null,
                is_active: stepFormData.is_active,
                prompt_image_url: stepFormData.prompt_image_url || null,
                updated_at: new Date().toISOString()
            }

            if (editingStep && editingStep.id) {
                stepData.id = editingStep.id
                stepData.step_index = originalStepIndex
            } else {
                const configRes = await fetch(`/api/analysis/config?projectId=${projectId}`)
                const configData = await configRes.json()
                const maxIndex = configData.steps?.reduce((max, s) => Math.max(max, s.step_index || 0), 0) || 0
                stepData.step_index = maxIndex + 1
            }

            const res = await fetch(`/api/analysis/config?projectId=${projectId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'step',
                    data: stepData
                })
            })

            const result = await res.json()
            if (!res.ok) throw new Error(result.error || 'Failed to save')

            const savedStepId = result.step?.id || editingStep?.id

            // Upload any temporary attachments
            const tempAttachments = attachments.filter(att => att._tempFile)
            if (tempAttachments.length > 0 && savedStepId) {
                for (const tempAtt of tempAttachments) {
                    try {
                        const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'uploads'
                        const fileExt = tempAtt.file_name.split('.').pop()
                        const fileName = `step-attachments/${savedStepId}/${Date.now()}.${fileExt}`

                        const { data, error: uploadError } = await supabase.storage
                            .from(bucket)
                            .upload(fileName, tempAtt._tempFile, { upsert: false })

                        if (uploadError) throw uploadError

                        const attachRes = await fetch('/api/analysis/step-attachments', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                stepId: savedStepId,
                                fileName: tempAtt.file_name,
                                storageUrl: data.path,
                                mimeType: tempAtt.mime_type,
                                fileSize: tempAtt.file_size,
                                fileType: tempAtt.file_type
                            })
                        })

                        if (!attachRes.ok) {
                            const attachResult = await attachRes.json()
                            throw new Error(attachResult.error)
                        }
                    } catch (uploadErr) {
                        console.error('Failed to upload temp attachment:', uploadErr)
                        // Continue with other attachments even if one fails
                    }
                }
            }

            // Refresh list and close modal
            await fetchConfig()
            handleCloseStepModal()
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    function handleProjectChange(e) {
        const newProjectId = e.target.value
        setProjectId(newProjectId)
        setSteps([])
        if (newProjectId) {
            router.push(`/admin/steps?projectId=${newProjectId}`, undefined, { shallow: true })
        }
    }

    function getRoleName(roleId) {
        const role = roles.find(r => r.id === roleId)
        return role ? role.name : '-'
    }

    async function handleToggleDefault(project) {
        const newIsDefault = !project.is_default
        try {
            const res = await fetch('/api/projects', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.id,
                    isDefault: newIsDefault,
                    userId: userId
                })
            })
            const result = await res.json()
            if (!res.ok) throw new Error(result.error)

            // Update local state
            setProjects(prev => prev.map(p => ({
                ...p,
                is_default: p.id === project.id ? newIsDefault : (newIsDefault ? false : p.is_default)
            })))
        } catch (err) {
            setError(err.message)
        }
    }

    const selectedProject = projects.find(p => p.id === projectId)

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
                currentPath="/admin/steps"
                userName={userName}
                permissions={permissions}
            />

            <main style={styles.container}>
                {/* Header */}
                <header style={styles.header}>
                    <div style={styles.headerLeft}>
                        <ClipboardList size={28} color="#1a1a2e" style={{ marginRight: 10 }} />
                        <h1 style={styles.title}>Prompt 管理後台</h1>
                    </div>
                </header>

                <div style={styles.body}>
                    {/* Project Header - Direct Display */}
                    {selectedProject ? (
                        <div style={styles.projectHeader}>
                            <div style={styles.projectHeaderLeft}>
                                <h2 style={styles.projectName}>{selectedProject.name}</h2>
                                {selectedProject.description && (
                                    <span style={styles.projectDesc}>{selectedProject.description}</span>
                                )}
                            </div>
                            <div style={styles.projectHeaderRight}>
                                <label style={styles.defaultCheckboxLabel}>
                                    <input
                                        type="checkbox"
                                        checked={selectedProject.is_default || false}
                                        onChange={() => handleToggleDefault(selectedProject)}
                                        style={styles.defaultCheckbox}
                                    />
                                    <span style={selectedProject.is_default ? styles.defaultBadgeActive : styles.defaultBadge}>
                                        {selectedProject.is_default ? '⭐ 預設模式' : '設為預設'}
                                    </span>
                                </label>
                                <a href="/admin" style={styles.backLink}>
                                    ← 返回分析模式列表
                                </a>
                            </div>
                        </div>
                    ) : loadingProjects ? (
                        <div style={styles.loading}>載入中...</div>
                    ) : null}

                    {error && <div style={styles.error}>{error}</div>}
                    {saving && <div style={styles.savingIndicator}>儲存中...</div>}

                    {/* Steps Table */}
                    {loading && <div style={styles.loading}>載入步驟中...</div>}

                    {!loading && projectId && steps.length > 0 && (
                        <>
                            <div style={styles.tableContainer}>
                                <table style={styles.table}>
                                    <thead>
                                        <tr style={styles.tableHeaderRow}>
                                            <th style={styles.thDrag}></th>
                                            <th style={styles.th}>步驟</th>
                                            <th style={{ ...styles.th, textAlign: 'left' }}>名稱</th>
                                            <th style={{ ...styles.th, textAlign: 'left' }}>Prompt 預覽</th>
                                            <th style={styles.th}>圖片</th>
                                            <th style={styles.th}>狀態</th>
                                            <th style={styles.th}>操作</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {steps.map((step, index) => (
                                            <tr
                                                key={step.id}
                                                draggable
                                                onDragStart={() => handleDragStart(index)}
                                                onDragEnter={() => handleDragEnter(index)}
                                                onDragEnd={handleDragEnd}
                                                onDragOver={(e) => e.preventDefault()}
                                                style={styles.tableRow}
                                            >
                                                <td style={styles.tdDrag}>
                                                    <span style={styles.dragHandle} title="拖曳排序">⋮⋮</span>
                                                </td>
                                                <td style={styles.tdStep}>
                                                    <span style={styles.stepBadge}>{step.step_index}</span>
                                                </td>
                                                <td style={styles.tdName}>
                                                    <div style={styles.stepTitle}>
                                                        步驟{step.step_index}: {step.title}
                                                    </div>
                                                    <div style={styles.stepDesc}>
                                                        {step.analysis_scope === 'individual' ? '個別分析' : '集體分析'}
                                                        {step.role_id && ` • 角色: ${getRoleName(step.role_id)}`}
                                                    </div>
                                                </td>
                                                <td style={styles.tdPrompt}>
                                                    <div style={styles.promptPreview}>
                                                        {step.prompt_template?.substring(0, 60)}...
                                                    </div>
                                                </td>
                                                <td style={styles.tdCenter}>
                                                    {step.prompt_image_url ? (
                                                        <span style={styles.imageIndicator}>🖼️</span>
                                                    ) : (
                                                        <span style={styles.noImage}>—</span>
                                                    )}
                                                </td>
                                                <td style={styles.tdCenter}>
                                                    <button
                                                        onClick={() => handleToggleStatus(step)}
                                                        style={step.is_active ? styles.statusActive : styles.statusInactive}
                                                    >
                                                        {step.is_active ? '啟用中' : '已停用'}
                                                    </button>
                                                </td>
                                                <td style={styles.tdActions}>
                                                    <button
                                                        onClick={() => handleEdit(step)}
                                                        style={styles.editButton}
                                                    >
                                                        <Edit size={14} style={{ marginRight: 4 }} />
                                                        編輯
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(step.id, step.title)}
                                                        style={styles.deleteButton}
                                                    >
                                                        <Trash2 size={14} style={{ marginRight: 4 }} />
                                                        刪除
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Add Step Button - at bottom of steps list */}
                            <div style={styles.addStepContainer}>
                                <button onClick={handleAdd} style={styles.addStepButton}>
                                    <Plus size={16} style={{ marginRight: 6 }} />
                                    新增步驟
                                </button>
                            </div>
                        </>
                    )}

                    {!loading && projectId && steps.length === 0 && (
                        <div style={styles.empty}>
                            <p>此分析模式尚無分析步驟</p>
                            <button onClick={handleAdd} style={styles.addButton}>
                                <Plus size={16} style={{ marginRight: 6 }} />
                                新增第一個步驟
                            </button>
                        </div>
                    )}

                    {!projectId && !loadingProjects && (
                        <div style={styles.empty}>
                            <p>請從分析模式管理頁面選擇「編輯步驟」進入</p>
                            <a href="/admin" style={styles.backLinkButton}>
                                ← 前往分析模式管理
                            </a>
                        </div>
                    )}
                </div>
            </main>

            {/* Step Modal */}
            {showStepModal && (
                <div style={adminStyles.modalOverlay} onClick={handleCloseStepModal}>
                    <div style={{ ...adminStyles.modalLarge, maxWidth: 800, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
                        <h2 style={adminStyles.modalTitle}>
                            {editingStep ? '編輯步驟' : '新增步驟'}
                        </h2>

                        <form onSubmit={handleStepFormSubmit}>
                            {/* Title */}
                            <div style={adminStyles.formGroup}>
                                <label style={adminStyles.formLabel}>步驟標題 *</label>
                                <input
                                    type="text"
                                    value={stepFormData.title}
                                    onChange={(e) => handleStepFormChange('title', e.target.value)}
                                    placeholder="例如:開放性編碼"
                                    style={adminStyles.input}
                                    required
                                />
                            </div>

                            {/* Prompt Template */}
                            <div style={adminStyles.formGroup}>
                                <label style={adminStyles.formLabel}>Prompt 模板 *</label>
                                <textarea
                                    value={stepFormData.prompt_template}
                                    onChange={(e) => handleStepFormChange('prompt_template', e.target.value)}
                                    placeholder="請輸入 Prompt 內容，可使用 {{ variable }} 格式的變數..."
                                    style={{ ...adminStyles.textarea, minHeight: 200 }}
                                    required
                                />
                                <div style={{ ...adminStyles.infoBox, marginTop: 8 }}>
                                    <strong>📌 可用變數 (Nunjucks 語法)</strong><br />
                                    {stepFormData.analysis_scope === 'individual' ? (
                                        <div style={{ fontSize: 13, marginTop: 6 }}>
                                            <code>{'{{ transcript }}'}</code> 當前檔案的逐字稿<br />
                                            <code>{'{{ filename }}'}</code> 當前檔案名稱<br />
                                            <code>{'{{ previous_step_result }}'}</code> 前一步驟對此檔案的結果<br />
                                            <code>{'{{ previous_step_result | tojson }}'}</code> 前一步驟結果 (JSON 格式)<br />
                                            <code>{'{{ steps[1] }}'}</code> 第 1 步驟的所有結果
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: 13, marginTop: 6 }}>
                                            <code>{'{{ files }}'}</code> 所有檔案列表<br />
                                            <code>{'{{ previous_step_all_results }}'}</code> 前一步驟所有檔案的結果<br />
                                            <code>{'{% for r in previous_step_all_results %}...{% endfor %}'}</code> 迴圈處理<br />
                                            <code>{'{{ steps[1] | tojson }}'}</code> 第 1 步驟結果 (JSON 格式)
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Analysis Scope */}
                            <div style={adminStyles.formGroup}>
                                <label style={adminStyles.formLabel}>分析範圍</label>
                                <select
                                    value={stepFormData.analysis_scope}
                                    onChange={(e) => handleStepFormChange('analysis_scope', e.target.value)}
                                    style={adminStyles.select}
                                >
                                    <option value="individual">👤 個別分析 (Individual)</option>
                                    <option value="collective">👥 集體分析 (Collective)</option>
                                </select>
                            </div>

                            {/* Role */}
                            <div style={adminStyles.formGroup}>
                                <label style={adminStyles.formLabel}>AI 角色 (選填)</label>
                                <select
                                    value={stepFormData.role_id}
                                    onChange={(e) => handleStepFormChange('role_id', e.target.value)}
                                    style={adminStyles.select}
                                >
                                    <option value="">預設角色</option>
                                    {roles.map(role => (
                                        <option key={role.id} value={role.id}>{role.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Prompt Image */}
                            <div style={adminStyles.formGroup}>
                                <label style={adminStyles.formLabel}>Prompt 圖片 (選填)</label>
                                {stepFormData.prompt_image_url ? (
                                    <div style={{ position: 'relative', display: 'inline-block' }}>
                                        <img
                                            src={stepFormData.prompt_image_url}
                                            alt="Prompt"
                                            style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, display: 'block' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={handleRemoveImage}
                                            style={{
                                                position: 'absolute',
                                                top: 8,
                                                right: 8,
                                                background: '#dc2626',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: 6,
                                                padding: '6px 10px',
                                                cursor: 'pointer',
                                                fontSize: 12,
                                                fontWeight: 600
                                            }}
                                        >
                                            <X size={14} /> 移除
                                        </button>
                                    </div>
                                ) : (
                                    <label style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        padding: '10px 16px',
                                        background: '#f3f4f6',
                                        border: '2px dashed #d1d5db',
                                        borderRadius: 8,
                                        cursor: 'pointer',
                                        fontSize: 14,
                                        color: '#374151'
                                    }}>
                                        <ImageIcon size={16} style={{ marginRight: 6 }} />
                                        {uploadingImage ? '上傳中...' : '上傳圖片'}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            style={{ display: 'none' }}
                                            disabled={uploadingImage}
                                        />
                                    </label>
                                )}
                            </div>

                            {/* Reference Files (Attachments) */}
                            <div style={{
                                ...adminStyles.formGroup,
                                borderTop: '2px solid #e5e7eb',
                                paddingTop: 20,
                                marginTop: 20
                            }}>
                                <label style={adminStyles.formLabel}>📎 參考檔案</label>
                                <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
                                    上傳範例檔案供 AI 分析時參考 (TXT/DOCX/PDF, 最大 3MB)
                                    {(!editingStep || !editingStep.id) && (
                                        <><br /><span style={{ color: '#f59e0b' }}>💡 檔案將在步驟儲存後自動上傳</span></>
                                    )}
                                </p>

                                {/* Attachments List */}
                                {attachments.length > 0 && (
                                    <div style={{ marginBottom: 16 }}>
                                        {attachments.map(att => (
                                            <div key={att.id} style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '10px 12px',
                                                background: att._tempFile ? '#fff7ed' : '#f9fafb',
                                                borderRadius: 8,
                                                marginBottom: 8,
                                                border: att._tempFile ? '1px dashed #fb923c' : 'none'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ fontSize: 20 }}>
                                                        {att.file_type === 'pdf' ? '📄' : att.file_type === 'document' ? '📝' : att.file_type === 'image' ? '🖼️' : '📎'}
                                                    </span>
                                                    <div>
                                                        <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1a2e' }}>
                                                            {att.file_name}
                                                            {att._tempFile && <span style={{ color: '#f59e0b', fontSize: 12, marginLeft: 6 }}>(待上傳)</span>}
                                                        </div>
                                                        <div style={{ fontSize: 12, color: '#9ca3af' }}>
                                                            {(att.file_size / 1024).toFixed(1)} KB
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (att._tempFile) {
                                                            setAttachments(attachments.filter(a => a.id !== att.id))
                                                        } else {
                                                            handleDeleteAttachment(att.id)
                                                        }
                                                    }}
                                                    style={{
                                                        padding: '6px 12px',
                                                        background: '#fff',
                                                        color: '#dc2626',
                                                        border: '1px solid #fecaca',
                                                        borderRadius: 6,
                                                        cursor: 'pointer',
                                                        fontSize: 12
                                                    }}
                                                >
                                                    刪除
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Upload Button */}
                                <label style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '10px 16px',
                                    background: '#f0f4ff',
                                    border: '2px dashed #4361ee',
                                    borderRadius: 8,
                                    cursor: 'pointer',
                                    fontSize: 14,
                                    color: '#4361ee',
                                    fontWeight: 500
                                }}>
                                    <Upload size={16} style={{ marginRight: 6 }} />
                                    {uploadingAttachment ? '上傳中...' : '上傳參考檔案'}
                                    <input
                                        type="file"
                                        accept=".txt,.pdf,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                        onChange={handleAttachmentUpload}
                                        style={{ display: 'none' }}
                                        disabled={uploadingAttachment}
                                    />
                                </label>
                            </div>


                            {/* Actions */}
                            <div style={adminStyles.modalActions}>
                                <button
                                    type="button"
                                    onClick={handleCloseStepModal}
                                    style={adminStyles.cancelButton}
                                    disabled={saving}
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    style={adminStyles.submitButton}
                                    disabled={saving}
                                >
                                    {saving ? '儲存中...' : '儲存'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
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
    headerIcon: {
        fontSize: 28
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
        maxWidth: 1200,
        margin: '0 auto'
    },
    addButton: {
        padding: '12px 24px',
        fontSize: 14,
        background: '#10b981',
        color: '#fff',
        border: '3px solid #1a1a2e',
        borderRadius: 10,
        cursor: 'pointer',
        fontWeight: 600,
        boxShadow: '3px 3px 0 #1a1a2e'
    },
    projectHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#fff',
        padding: '24px 28px',
        borderRadius: 16,
        marginBottom: 24,
        border: '3px solid #1a1a2e',
        boxShadow: '4px 4px 0 #e5e7eb'
    },
    projectHeaderLeft: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6
    },
    projectHeaderRight: {
        display: 'flex',
        alignItems: 'center',
        gap: 20
    },
    projectName: {
        fontSize: 24,
        fontWeight: 700,
        color: '#1a1a2e',
        margin: 0
    },
    projectDesc: {
        fontSize: 14,
        color: '#6b7280'
    },
    backLink: {
        fontSize: 14,
        color: '#4361ee',
        textDecoration: 'none',
        fontWeight: 500
    },
    backLinkButton: {
        display: 'inline-block',
        padding: '12px 24px',
        fontSize: 14,
        background: '#4361ee',
        color: '#fff',
        textDecoration: 'none',
        borderRadius: 10,
        fontWeight: 600,
        marginTop: 16
    },
    label: {
        fontSize: 14,
        fontWeight: 600,
        color: '#374151'
    },
    loadingText: {
        fontSize: 14,
        color: '#6b7280'
    },
    select: {
        padding: '12px 16px',
        fontSize: 14,
        border: '2px solid #e5e7eb',
        borderRadius: 10,
        minWidth: 300,
        outline: 'none',
        background: '#fff'
    },
    newProjectButton: {
        padding: '12px 24px',
        fontSize: 14,
        background: '#4361ee',
        color: '#fff',
        border: '3px solid #1a1a2e',
        borderRadius: 10,
        cursor: 'pointer',
        fontWeight: 600,
        boxShadow: '3px 3px 0 #1a1a2e'
    },
    projectInfo: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#e8edfc',
        padding: '12px 16px',
        borderRadius: 10,
        marginBottom: 20,
        fontSize: 14,
        color: '#374151'
    },
    projectInfoLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap'
    },
    projectDesc: {
        color: '#6b7280'
    },
    projectId: {
        color: '#6b7280',
        fontSize: 12,
        fontFamily: 'monospace',
        marginLeft: 12
    },
    defaultCheckboxLabel: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer'
    },
    defaultCheckbox: {
        width: 18,
        height: 18,
        cursor: 'pointer'
    },
    defaultBadge: {
        padding: '6px 14px',
        fontSize: 13,
        background: '#f3f4f6',
        color: '#6b7280',
        border: '2px solid #d1d5db',
        borderRadius: 8,
        fontWeight: 500
    },
    defaultBadgeActive: {
        padding: '6px 14px',
        fontSize: 13,
        background: '#fef3c7',
        color: '#92400e',
        border: '2px solid #f59e0b',
        borderRadius: 8,
        fontWeight: 600
    },
    error: {
        padding: 12,
        background: '#fee2e2',
        color: '#dc2626',
        borderRadius: 8,
        marginBottom: 16
    },
    savingIndicator: {
        padding: 8,
        background: '#dbeafe',
        color: '#1e40af',
        borderRadius: 8,
        marginBottom: 16,
        textAlign: 'center',
        fontSize: 14
    },
    loading: {
        textAlign: 'center',
        padding: 40,
        color: '#6b7280'
    },
    tableContainer: {
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        overflow: 'hidden'
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse'
    },
    tableHeaderRow: {
        background: '#f9fafb',
        borderBottom: '1px solid #e5e7eb'
    },
    th: {
        padding: '14px 16px',
        fontSize: 13,
        fontWeight: 600,
        color: '#6b7280',
        textAlign: 'center'
    },
    thDrag: {
        width: 32,
        padding: '14px 8px'
    },
    tdDrag: {
        width: 32,
        padding: '12px 8px',
        textAlign: 'center',
        cursor: 'grab'
    },
    dragHandle: {
        color: '#9ca3af',
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: -2,
        cursor: 'grab',
        userSelect: 'none'
    },
    tableRow: {
        borderBottom: '1px solid #f3f4f6',
        cursor: 'grab',
        transition: 'background 0.2s'
    },
    tdStep: {
        padding: '16px',
        textAlign: 'center',
        width: 60
    },
    stepBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        background: '#4361ee',
        color: '#fff',
        borderRadius: '50%',
        fontSize: 14,
        fontWeight: 600
    },
    tdName: {
        padding: '16px',
        minWidth: 200
    },
    stepTitle: {
        fontSize: 15,
        fontWeight: 600,
        color: '#1a1a2e',
        marginBottom: 4
    },
    stepDesc: {
        fontSize: 13,
        color: '#6b7280'
    },
    tdPrompt: {
        padding: '16px',
        maxWidth: 300
    },
    promptPreview: {
        fontSize: 13,
        color: '#6b7280',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    },
    tdCenter: {
        padding: '16px',
        textAlign: 'center'
    },
    imageIndicator: {
        fontSize: 20
    },
    noImage: {
        color: '#d1d5db'
    },
    statusActive: {
        padding: '6px 12px',
        fontSize: 12,
        background: '#dcfce7',
        color: '#166534',
        border: 'none',
        borderRadius: 20,
        cursor: 'pointer',
        fontWeight: 500
    },
    statusInactive: {
        padding: '6px 12px',
        fontSize: 12,
        background: '#f3f4f6',
        color: '#6b7280',
        border: 'none',
        borderRadius: 20,
        cursor: 'pointer',
        fontWeight: 500
    },
    tdActions: {
        padding: '16px',
        display: 'flex',
        gap: 8,
        justifyContent: 'center'
    },
    editButton: {
        display: 'flex',
        alignItems: 'center',
        padding: '8px 14px',
        fontSize: 13,
        background: '#fbbf24',
        color: '#78350f',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        fontWeight: 500
    },
    deleteButton: {
        display: 'flex',
        alignItems: 'center',
        padding: '8px 14px',
        fontSize: 13,
        background: '#ef4444',
        color: '#fff',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        fontWeight: 500
    },
    empty: {
        textAlign: 'center',
        padding: 60,
        color: '#6b7280',
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
    },
    // Modal styles
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
    },
    modal: {
        background: '#fff',
        padding: 32,
        borderRadius: 16,
        width: '100%',
        maxWidth: 480,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 600,
        color: '#1a1a2e',
        marginBottom: 24,
        margin: '0 0 24px 0'
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
        fontSize: 14,
        border: '1px solid #d1d5db',
        borderRadius: 8,
        outline: 'none',
        boxSizing: 'border-box'
    },
    textarea: {
        width: '100%',
        padding: '12px 14px',
        fontSize: 14,
        border: '1px solid #d1d5db',
        borderRadius: 8,
        outline: 'none',
        resize: 'vertical',
        boxSizing: 'border-box'
    },
    modalActions: {
        display: 'flex',
        gap: 12,
        justifyContent: 'flex-end',
        marginTop: 24
    },
    cancelButton: {
        padding: '10px 20px',
        fontSize: 14,
        background: '#f3f4f6',
        color: '#374151',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        fontWeight: 500
    },
    addStepContainer: {
        display: 'flex',
        justifyContent: 'center',
        padding: '20px 0',
        borderTop: '1px dashed #e5e7eb'
    },
    addStepButton: {
        padding: '12px 32px',
        fontSize: 14,
        background: '#10b981',
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        fontWeight: 600,
        boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)'
    }
}
