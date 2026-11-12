import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../../lib/supabaseClient'

export default function StepEditPage() {
    const router = useRouter()
    const { projectId, id: stepId } = router.query

    const isEditing = !!stepId

    const [roles, setRoles] = useState([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [uploadingAttachment, setUploadingAttachment] = useState(false)
    const [error, setError] = useState(null)

    // Attachments state
    const [attachments, setAttachments] = useState([])

    const [formData, setFormData] = useState({
        title: '',
        prompt_template: '',
        analysis_scope: 'individual',
        role_id: '',
        is_active: true,
        prompt_image_url: ''
    })

    // Store original step_index when editing
    const [originalStepIndex, setOriginalStepIndex] = useState(null)

    useEffect(() => {
        if (projectId) {
            fetchData()
        }
    }, [projectId, stepId])

    async function fetchData() {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch(`/api/analysis/config?projectId=${projectId}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to fetch')

            setRoles(data.roles || [])

            // If editing, find the step and populate form
            if (stepId && data.steps) {
                const step = data.steps.find(s => s.id === stepId)
                if (step) {
                    setFormData({
                        title: step.title || '',
                        prompt_template: step.prompt_template || '',
                        analysis_scope: step.analysis_scope || 'individual',
                        role_id: step.role_id || '',
                        is_active: step.is_active !== false,
                        prompt_image_url: step.prompt_image_url || ''
                    })
                    // Save original step_index for later use
                    setOriginalStepIndex(step.step_index)

                    // Fetch attachments for this step
                    fetchAttachments(stepId)
                }
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
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

    async function handleAttachmentUpload(e) {
        const file = e.target.files?.[0]
        if (!file) return

        // Validate file type
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

        // Validate file size (max 3MB)
        if (file.size > 3 * 1024 * 1024) {
            setError('檔案大小不能超過 3MB')
            return
        }

        if (!stepId) {
            setError('請先儲存步驟後再上傳附件')
            return
        }

        setUploadingAttachment(true)
        setError(null)

        try {
            const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'uploads'
            const fileExt = file.name.split('.').pop()
            const fileName = `step-attachments/${stepId}/${Date.now()}.${fileExt}`

            // 1. Upload to Supabase Storage
            const { data, error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(fileName, file, { upsert: false })

            if (uploadError) throw uploadError

            // 2. Determine file type category
            let fileType = 'reference'
            if (file.type.startsWith('image/')) fileType = 'image'
            else if (file.type === 'application/pdf') fileType = 'pdf'
            else if (file.type.includes('word')) fileType = 'document'

            // 3. Save attachment record to database
            const res = await fetch('/api/analysis/step-attachments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    stepId,
                    fileName: file.name,
                    storageUrl: data.path,
                    mimeType: file.type,
                    fileSize: file.size,
                    fileType
                })
            })

            const result = await res.json()
            if (!res.ok) throw new Error(result.error)

            // 4. Update attachments list
            setAttachments([...attachments, result.attachment])

            // Clear file input
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

            // Remove from list
            setAttachments(attachments.filter(att => att.id !== attachmentId))
        } catch (err) {
            setError('刪除附件失敗：' + err.message)
        }
    }

    async function handleImageUpload(e) {
        const file = e.target.files?.[0]
        if (!file) return

        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        if (!validTypes.includes(file.type)) {
            setError('請上傳 JPG、PNG、GIF 或 WebP 格式的圖片')
            return
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setError('圖片大小不能超過 5MB')
            return
        }

        setUploading(true)
        setError(null)

        try {
            const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'uploads'
            const fileExt = file.name.split('.').pop()
            const fileName = `${projectId}/step-images/${Date.now()}.${fileExt}`

            const { data, error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(fileName, file, { upsert: false })

            if (uploadError) throw uploadError

            // Get public URL
            const { data: urlData } = supabase.storage
                .from(bucket)
                .getPublicUrl(data.path)

            setFormData(prev => ({
                ...prev,
                prompt_image_url: urlData.publicUrl
            }))
        } catch (err) {
            setError('圖片上傳失敗：' + err.message)
        } finally {
            setUploading(false)
        }
    }

    function handleRemoveImage() {
        setFormData(prev => ({
            ...prev,
            prompt_image_url: ''
        }))
    }

    async function handleSubmit(e) {
        e.preventDefault()

        if (!formData.title.trim()) {
            setError('請輸入步驟標題')
            return
        }
        if (!formData.prompt_template.trim()) {
            setError('請輸入 Prompt 模板')
            return
        }

        setSaving(true)
        setError(null)

        try {
            // For new steps, we need to get the next step_index
            let stepData = {
                project_id: projectId,
                title: formData.title,
                prompt_template: formData.prompt_template,
                analysis_scope: formData.analysis_scope,
                role_id: formData.role_id || null,
                is_active: formData.is_active,
                prompt_image_url: formData.prompt_image_url || null,
                updated_at: new Date().toISOString()
            }

            if (isEditing) {
                stepData.id = stepId
                // Preserve original step_index when editing
                stepData.step_index = originalStepIndex
            } else {
                // Get current steps to determine next index
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

            // Navigate back to list
            router.push(`/admin/steps?projectId=${projectId}`)
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    function handleChange(field, value) {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }))
    }

    function handleCancel() {
        router.push(`/admin/steps?projectId=${projectId}`)
    }

    if (!projectId) {
        return (
            <main style={styles.container}>
                <div style={styles.error}>缺少 Project ID</div>
            </main>
        )
    }

    return (
        <main style={styles.container}>
            {/* Header */}
            <header style={styles.header}>
                <div style={styles.headerLeft}>
                    <span style={styles.headerIcon}>⚙️</span>
                    <h1 style={styles.title}>
                        {isEditing ? '編輯步驟' : '新增步驟'}
                    </h1>
                </div>
                <div style={styles.headerRight}>
                    <a href={`/admin/steps?projectId=${projectId}`} style={styles.backLink}>
                        ← 返回列表
                    </a>
                </div>
            </header>

            {error && <div style={styles.error}>{error}</div>}

            {loading ? (
                <div style={styles.loading}>載入中...</div>
            ) : (
                <form onSubmit={handleSubmit} style={styles.form}>
                    {/* Title */}
                    <div style={styles.formGroup}>
                        <label style={styles.label}>步驟標題 *</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={e => handleChange('title', e.target.value)}
                            placeholder="例如：資料整理"
                            style={styles.input}
                        />
                    </div>

                    {/* Prompt Template */}
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Prompt 模板 *</label>
                        <textarea
                            value={formData.prompt_template}
                            onChange={e => handleChange('prompt_template', e.target.value)}
                            placeholder="請輸入 Prompt 內容，可使用 {{ variable }} 格式的變數..."
                            style={styles.textarea}
                            rows={10}
                        />
                        <div style={styles.variableDoc}>
                            <div style={styles.variableDocTitle}>📌 可用變數（Nunjucks 語法）</div>
                            {formData.analysis_scope === 'individual' ? (
                                <div style={styles.variableList}>
                                    <code>{'{{ transcript }}'}</code> 當前檔案的逐字稿<br />
                                    <code>{'{{ filename }}'}</code> 當前檔案名稱<br />
                                    <code>{'{{ previous_step_result }}'}</code> 前一步驟對此檔案的結果<br />
                                    <code>{'{{ previous_step_result | tojson }}'}</code> 前一步驟結果（JSON 格式）<br />
                                    <code>{'{{ steps[1] }}'}</code> 第 1 步驟的所有結果<br />
                                </div>
                            ) : (
                                <div style={styles.variableList}>
                                    <code>{'{{ files }}'}</code> 所有檔案列表<br />
                                    <code>{'{{ previous_step_all_results }}'}</code> 前一步驟所有檔案的結果<br />
                                    <code>{'{% for r in previous_step_all_results %}...{% endfor %}'}</code> 迴圈處理<br />
                                    <code>{'{{ steps[1] | tojson }}'}</code> 第 1 步驟結果（JSON 格式）<br />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Analysis Scope */}
                    <div style={styles.formGroup}>
                        <label style={styles.label}>分析範圍</label>
                        <select
                            value={formData.analysis_scope}
                            onChange={e => handleChange('analysis_scope', e.target.value)}
                            style={styles.select}
                        >
                            <option value="individual">👤 個別分析 (Individual)</option>
                            <option value="collective">👥 集體分析 (Collective)</option>
                        </select>
                    </div>

                    {/* Role */}
                    <div style={styles.formGroup}>
                        <label style={styles.label}>AI 角色 (選填)</label>
                        <select
                            value={formData.role_id}
                            onChange={e => handleChange('role_id', e.target.value)}
                            style={styles.select}
                        >
                            <option value="">-- 不指定角色 --</option>
                            {roles.map(role => (
                                <option key={role.id} value={role.id}>
                                    {role.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Image Upload */}
                    <div style={styles.formGroup}>
                        <label style={styles.label}>步驟圖片 (選填)</label>

                        {formData.prompt_image_url ? (
                            <div style={styles.imagePreviewContainer}>
                                <img
                                    src={formData.prompt_image_url}
                                    alt="Step image"
                                    style={styles.imagePreview}
                                />
                                <div style={styles.imageActions}>
                                    <span style={styles.imageUrl}>
                                        {formData.prompt_image_url.substring(0, 50)}...
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleRemoveImage}
                                        style={styles.removeImageButton}
                                    >
                                        移除圖片
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={styles.uploadContainer}>
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/gif,image/webp"
                                    onChange={handleImageUpload}
                                    style={styles.fileInput}
                                    id="image-upload"
                                    disabled={uploading}
                                />
                                <label htmlFor="image-upload" style={styles.uploadLabel}>
                                    {uploading ? (
                                        '上傳中...'
                                    ) : (
                                        <>
                                            <span style={styles.uploadIcon}>📤</span>
                                            點擊上傳圖片
                                        </>
                                    )}
                                </label>
                                <p style={styles.uploadHint}>
                                    支援 JPG、PNG、GIF、WebP 格式，最大 5MB
                                </p>
                            </div>
                        )}

                        {/* URL fallback input */}
                        <div style={styles.urlFallback}>
                            <span style={styles.urlFallbackLabel}>或直接輸入圖片網址：</span>
                            <input
                                type="text"
                                value={formData.prompt_image_url}
                                onChange={e => handleChange('prompt_image_url', e.target.value)}
                                placeholder="https://..."
                                style={styles.urlInput}
                            />
                        </div>
                    </div>

                    {/* Status */}
                    <div style={styles.formGroup}>
                        <label style={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={formData.is_active}
                                onChange={e => handleChange('is_active', e.target.checked)}
                                style={styles.checkbox}
                            />
                            啟用此步驟
                        </label>
                    </div>

                    {/* Reference Files / Attachments */}
                    <div style={styles.formGroup}>
                        <label style={styles.label}>
                            📎 參考檔案 (選填)
                        </label>
                        <p style={styles.attachmentDescription}>
                            上傳此步驟需要的參考資料，AI 在執行分析時會先讀取這些檔案
                            <br />
                            <small style={{ color: '#6b7280' }}>
                                例如：編碼規則說明、分析框架圖、JTBD 範例文件等
                            </small>
                        </p>

                        {/* Existing attachments list */}
                        {attachments.length > 0 && (
                            <div style={styles.attachmentList}>
                                {attachments.map(att => (
                                    <div key={att.id} style={styles.attachmentItem}>
                                        <div style={styles.attachmentInfo}>
                                            <span style={styles.attachmentIcon}>
                                                {att.file_type === 'image' && '🖼️'}
                                                {att.file_type === 'pdf' && '📄'}
                                                {att.file_type === 'document' && '📝'}
                                                {att.file_type === 'reference' && '📎'}
                                            </span>
                                            <div style={styles.attachmentDetails}>
                                                <div style={styles.attachmentName}>{att.file_name}</div>
                                                <div style={styles.attachmentMeta}>
                                                    {att.mime_type} · {Math.round(att.file_size / 1024)} KB
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteAttachment(att.id)}
                                            style={styles.deleteAttachmentButton}
                                        >
                                            刪除
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Upload new attachment */}
                        {stepId ? (
                            <div style={styles.attachmentUploadContainer}>
                                <input
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.docx"
                                    onChange={handleAttachmentUpload}
                                    style={styles.fileInput}
                                    id="attachment-upload"
                                    disabled={uploadingAttachment}
                                />
                                <label htmlFor="attachment-upload" style={styles.attachmentUploadLabel}>
                                    {uploadingAttachment ? (
                                        '📤 上傳中...'
                                    ) : (
                                        <>
                                            <span style={styles.uploadIcon}>📤</span>
                                            上傳參考檔案
                                        </>
                                    )}
                                </label>
                                <p style={styles.uploadHint}>
                                    支援 JPG、PNG、PDF、TXT、DOCX 格式，最大 3MB
                                </p>
                            </div>
                        ) : (
                            <div style={styles.attachmentPlaceholder}>
                                <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
                                    💡 請先儲存步驟後再上傳參考檔案
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div style={styles.actions}>
                        <button
                            type="button"
                            onClick={handleCancel}
                            style={styles.cancelButton}
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            style={styles.saveButton}
                            disabled={saving || uploading}
                        >
                            {saving ? '儲存中...' : (isEditing ? '更新步驟' : '建立步驟')}
                        </button>
                    </div>
                </form>
            )}
        </main>
    )
}

const styles = {
    container: {
        padding: '24px 40px',
        maxWidth: 800,
        margin: '0 auto',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: '#fafafa',
        minHeight: '100vh'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        paddingBottom: 16,
        borderBottom: '1px solid #e5e7eb'
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
        fontSize: 24,
        fontWeight: 600,
        color: '#1a1a2e',
        margin: 0
    },
    headerRight: {
        display: 'flex',
        alignItems: 'center',
        gap: 16
    },
    backLink: {
        color: '#4361ee',
        textDecoration: 'none',
        fontSize: 14,
        fontWeight: 500
    },
    error: {
        padding: 12,
        background: '#fee2e2',
        color: '#dc2626',
        borderRadius: 8,
        marginBottom: 16
    },
    loading: {
        textAlign: 'center',
        padding: 40,
        color: '#6b7280'
    },
    form: {
        background: '#fff',
        padding: 32,
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
    },
    formGroup: {
        marginBottom: 24
    },
    label: {
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
        fontFamily: 'Monaco, Consolas, monospace',
        resize: 'vertical',
        boxSizing: 'border-box'
    },
    select: {
        width: '100%',
        padding: '12px 14px',
        fontSize: 14,
        border: '1px solid #d1d5db',
        borderRadius: 8,
        outline: 'none',
        background: '#fff',
        boxSizing: 'border-box'
    },
    // Image upload styles
    uploadContainer: {
        border: '2px dashed #d1d5db',
        borderRadius: 8,
        padding: 24,
        textAlign: 'center',
        background: '#f9fafb'
    },
    fileInput: {
        display: 'none'
    },
    uploadLabel: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 24px',
        background: '#4361ee',
        color: '#fff',
        borderRadius: 8,
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 500
    },
    uploadIcon: {
        fontSize: 18
    },
    uploadHint: {
        marginTop: 12,
        fontSize: 12,
        color: '#6b7280'
    },
    imagePreviewContainer: {
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 16,
        background: '#f9fafb'
    },
    imagePreview: {
        maxWidth: '100%',
        maxHeight: 200,
        borderRadius: 6,
        display: 'block',
        marginBottom: 12
    },
    imageActions: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    imageUrl: {
        fontSize: 12,
        color: '#6b7280',
        fontFamily: 'monospace'
    },
    removeImageButton: {
        padding: '6px 12px',
        fontSize: 12,
        background: '#ef4444',
        color: '#fff',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer'
    },
    urlFallback: {
        marginTop: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 12
    },
    urlFallbackLabel: {
        fontSize: 13,
        color: '#6b7280',
        whiteSpace: 'nowrap'
    },
    urlInput: {
        flex: 1,
        padding: '8px 12px',
        fontSize: 13,
        border: '1px solid #d1d5db',
        borderRadius: 6,
        outline: 'none'
    },
    checkboxLabel: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 14,
        color: '#374151',
        cursor: 'pointer'
    },
    checkbox: {
        width: 18,
        height: 18,
        cursor: 'pointer'
    },
    actions: {
        display: 'flex',
        gap: 12,
        justifyContent: 'flex-end',
        marginTop: 32,
        paddingTop: 24,
        borderTop: '1px solid #e5e7eb'
    },
    cancelButton: {
        padding: '12px 24px',
        fontSize: 14,
        background: '#f3f4f6',
        color: '#374151',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        fontWeight: 500
    },
    saveButton: {
        padding: '12px 24px',
        fontSize: 14,
        background: '#10b981',
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        fontWeight: 600
    },
    variableDoc: {
        marginTop: 12,
        padding: 12,
        background: '#f0fdf4',
        borderRadius: 8,
        border: '1px solid #bbf7d0'
    },
    variableDocTitle: {
        fontSize: 13,
        fontWeight: 600,
        color: '#166534',
        marginBottom: 8
    },
    variableList: {
        fontSize: 12,
        color: '#374151',
        lineHeight: 1.8
    },
    // Attachment styles
    attachmentDescription: {
        fontSize: 13,
        color: '#4b5563',
        marginBottom: 16,
        lineHeight: 1.6
    },
    attachmentList: {
        marginBottom: 16,
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        overflow: 'hidden'
    },
    attachmentItem: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        borderBottom: '1px solid #f3f4f6',
        background: '#fff'
    },
    attachmentInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flex: 1
    },
    attachmentIcon: {
        fontSize: 24
    },
    attachmentDetails: {
        flex: 1
    },
    attachmentName: {
        fontSize: 14,
        fontWeight: 500,
        color: '#1f2937',
        marginBottom: 2
    },
    attachmentMeta: {
        fontSize: 12,
        color: '#6b7280'
    },
    deleteAttachmentButton: {
        padding: '6px 12px',
        fontSize: 12,
        background: '#ef4444',
        color: '#fff',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        fontWeight: 500
    },
    attachmentUploadContainer: {
        border: '2px dashed #d1d5db',
        borderRadius: 8,
        padding: 20,
        textAlign: 'center',
        background: '#f9fafb'
    },
    attachmentUploadLabel: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 20px',
        background: '#10b981',
        color: '#fff',
        borderRadius: 8,
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 500
    },
    attachmentPlaceholder: {
        padding: 16,
        background: '#fef3c7',
        border: '1px solid #fcd34d',
        borderRadius: 8,
        textAlign: 'center'
    }
}
