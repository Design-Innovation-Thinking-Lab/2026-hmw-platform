import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { CheckCircle, Search } from '../../components/icons'

// ── Helper: render a single completed-step card during analysis ──
function LiveStepCard({ step }) {
    const [open, setOpen] = useState(false)
    const isError = step.hasError

    // Recursively collect all meaningful text strings from any JSON structure
    function extractMeaningfulTexts(obj, depth = 0) {
        if (depth > 5) return []
        if (typeof obj === 'string') {
            // Skip: too short, looks like JSON, pure technical IDs
            if (obj.length < 8) return []
            if (obj.startsWith('{') || obj.startsWith('[')) return []
            return [obj]
        }
        if (Array.isArray(obj)) {
            return obj.flatMap(v => extractMeaningfulTexts(v, depth + 1))
        }
        if (obj && typeof obj === 'object') {
            // Skip purely technical / numeric fields
            const SKIP_KEYS = new Set(['id', 'type', 'format', 'scope', 'index',
                'step', 'step_index', 'source_step6_insight_id'])
            return Object.entries(obj).flatMap(([k, v]) => {
                if (SKIP_KEYS.has(k)) return []
                if (typeof v === 'number' || typeof v === 'boolean') return []
                return extractMeaningfulTexts(v, depth + 1)
            })
        }
        return []
    }

    // Extract a readable item list from resultJson
    const getItems = (json) => {
        if (!json) return []
        if (Array.isArray(json)) return json
        // Try common array keys
        for (const key of [
            'hmw_statements', 'hmw_questions', 'HMW_questions', 'HMW_statements',
            'hmw清單', 'HMW清單', 'items', 'hmw', 'HMW',
            'JTBD_list', 'jtbd_list', 'insights', 'findings',
            'pain_points', 'gaps', 'observations', 'themes'
        ]) {
            if (Array.isArray(json[key]) && json[key].length > 0) return json[key]
        }
        // Generic: find first non-empty array value
        const firstArr = Object.values(json).find(v => Array.isArray(v) && v.length > 0)
        if (firstArr) return firstArr
        // Wrap object as single item
        return [json]
    }

    const renderItem = (item, idx) => {
        // Plain string
        if (typeof item === 'string') {
            return <p key={idx} className="live-step-item">• {item}</p>
        }
        if (!item || typeof item !== 'object') return null

        // Try known HMW / insight text keys
        const knownText =
            item.HMW_question || item.hmw_question || item['HMW問題'] || item['HMW 問題'] ||
            item['HMW問題句'] || item.question || item.statement || item.hmw ||
            item['洞察名稱'] || item['痛點'] || item.pain_point ||
            item['核心主題'] || item['觀察'] || item.observation ||
            item['finding'] || item['insight'] || null

        if (knownText && typeof knownText === 'string') {
            return <p key={idx} className="live-step-item">• {knownText}</p>
        }

        // Recursively extract all meaningful strings, pick the longest
        const texts = extractMeaningfulTexts(item)
        if (texts.length > 0) {
            const best = texts.sort((a, b) => b.length - a.length)[0]
            return <p key={idx} className="live-step-item">• {best.slice(0, 200)}</p>
        }

        // Absolute fallback: show "分析完成" instead of raw JSON
        return <p key={idx} className="live-step-item">• （分析完成）</p>
    }

    const items = getItems(step.resultJson)
    const scopeLabel = step.scope === 'collective' ? '集體分析' : step.scope === 'individual' ? '個別分析' : step.scope

    // For error steps, extract the error message for display
    const errorMessage = isError ? (step.resultJson?.error || '此步驟分析失敗') : null

    return (
        <div className={`live-step-card${isError ? ' live-step-card--error' : ''}`}>
            <button className="live-step-header" onClick={() => setOpen(o => !o)}>
                <span className="live-step-title">
                    {isError ? '⚠️ ' : '✅ '}
                    {step.stepIndex != null ? `${step.stepIndex}. ` : ''}{step.title}
                </span>
                <span className="live-step-meta">
                    {scopeLabel && <span className="live-step-scope">{scopeLabel}</span>}
                    {!isError && <span className="live-step-count">{items.length} 筆</span>}
                    <span className="live-step-toggle">{open ? '▲' : '▼'}</span>
                </span>
            </button>
            {open && (
                <div className="live-step-body">
                    {isError ? (
                        <p className="live-step-item live-step-error-msg">❌ {errorMessage}</p>
                    ) : (
                        <>
                            {items.slice(0, 5).map((item, idx) => renderItem(item, idx))}
                            {items.length > 5 && (
                                <p className="live-step-more">…還有 {items.length - 5} 筆</p>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}

// ── Keys displayed on the card FRONT – always hidden from the back ──
const HMW_FRONT_KEYS = new Set([
    'HMW_question', 'hmw_question', 'question',
    'HMW 問題', 'HMW問題', 'hmw_問題', 'HMW問題句',
    'HMW', 'hmw',
    'statement', 'text',
    'priority', 'importance', '優先級',
    '來源受訪者數', 'source_count',
    'hmw_id', 'hmwId', 'id', 'index'
])

// ─────────────────────────────────────────────────────────────────────────────
// CARD BACK SCHEMA
// Defines what appears on the back of every HMW card, in order.
// Each entry:
//   label  – displayed section title (Chinese)
//   keys   – all possible JSON key names to try, in priority order.
//            Supports dot notation for nested paths, e.g. 'supporting_jtbd.jtbd_statement'
//   type   – how to render the value:
//              'text'   → plain paragraph
//              'list'   → bulleted list (array of strings)
//              'quotes' → styled quote blocks (array of strings/objects with 原話/quote)
//              'object' → key-value pairs from a nested object
//              'tags'   → inline badge chips (array of strings)
//
// ➜ To add a new field: add an entry here. No other code changes needed.
// ─────────────────────────────────────────────────────────────────────────────
const CARD_BACK_SCHEMA = [
    {
        label: '對應 JTBD',
        keys: [
            '對應JTBD', 'jtbd_statement',
            'supporting_jtbd.jtbd_statement',   // coach mode nested
            'supporting_jtbd',                   // fallback: whole object
            'JTBD', 'jtbd', 'job_to_be_done'
        ],
        type: 'text'
    },
    {
        label: 'JTBD 類型',
        keys: ['supporting_jtbd.jtbd_type', 'jtbd_type'],
        type: 'text'
    },
    {
        label: '核心主題',
        keys: ['核心主題', 'core_theme', 'theme', 'topic'],
        type: 'text'
    },
    {
        label: '觀察到的痛點',
        keys: ['觀察到的痛點/挑戰', '觀察到的痛點', 'pain_point', 'challenge', '挑戰'],
        type: 'text'
    },
    {
        label: '服務創新三環',
        keys: ['服務創新三環', 'service_innovation', 'innovation_triangle'],
        type: 'object'
    },
    {
        label: '原始引用',
        keys: ['對應的原始資料來源', 'verbatim_list', 'evidence', 'quotes', '引用原文', 'supporting_evidence'],
        type: 'quotes'
    },
    {
        label: '設計焦點',
        keys: ['design_focus', '設計焦點', 'design_area'],
        type: 'tags'
    },
]

// ── Resolve a value from a card object using a key (supports dot notation) ──
function resolveKey(obj, key) {
    if (!obj || typeof obj !== 'object') return undefined
    if (!key.includes('.')) return obj[key]
    const [head, ...rest] = key.split('.')
    return resolveKey(obj[head], rest.join('.'))
}

// ── Render a single back-face section by type ──
function renderSection(label, value, type, keyName) {
    if (value === null || value === undefined || value === '') return null
    if (Array.isArray(value) && value.length === 0) return null

    const sectionKey = label + keyName

    if (type === 'text') {
        // If value is an object (e.g. supporting_jtbd was matched whole), render its fields
        if (typeof value === 'object' && !Array.isArray(value)) {
            const entries = Object.entries(value).filter(([, v]) => v != null && v !== '')
            if (entries.length === 0) return null
            return (
                <div key={sectionKey} className="back-section">
                    <span className="back-label">{label}</span>
                    {entries.map(([k, v]) => (
                        <p key={k} className="back-text">
                            <strong>{k}：</strong>
                            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                        </p>
                    ))}
                </div>
            )
        }
        return (
            <div key={sectionKey} className="back-section">
                <span className="back-label">{label}</span>
                <p className="back-text">{String(value)}</p>
            </div>
        )
    }

    if (type === 'list' || type === 'tags') {
        const items = Array.isArray(value) ? value : [value]
        if (type === 'tags') {
            return (
                <div key={sectionKey} className="back-section">
                    <span className="back-label">{label}</span>
                    <div className="back-tags">
                        {items.map((t, i) => <span key={i} className="back-tag">{String(t)}</span>)}
                    </div>
                </div>
            )
        }
        return (
            <div key={sectionKey} className="back-section">
                <span className="back-label">{label}</span>
                {items.map((item, i) => <p key={i} className="back-text">• {String(item)}</p>)}
            </div>
        )
    }

    if (type === 'quotes') {
        const items = Array.isArray(value) ? value : [value]
        return (
            <div key={sectionKey} className="back-section">
                <span className="back-label">{label}</span>
                {items.map((item, i) => {
                    if (typeof item === 'string') {
                        return <p key={i} className="back-quote">「{item}」</p>
                    }
                    if (item && typeof item === 'object') {
                        const quote = item['原話'] || item.quote || item.verbatim || item.content
                        const speaker = item['受訪者'] || item.speaker || item.interviewee
                        const src = item['來源檔案'] || item.source_file || item.filename
                        return (
                            <div key={i} className="verbatim-item">
                                {quote && <p className="back-quote">「{quote}」</p>}
                                {(speaker || src) && (
                                    <p className="source-info">
                                        {speaker && `📣 ${speaker}`}
                                        {speaker && src ? ' · ' : ''}
                                        {src && `📁 ${src}`}
                                    </p>
                                )}
                            </div>
                        )
                    }
                    return null
                })}
            </div>
        )
    }

    if (type === 'object') {
        if (typeof value !== 'object' || Array.isArray(value)) return null
        const entries = Object.entries(value).filter(([, v]) => v != null && v !== '')
        if (entries.length === 0) return null
        return (
            <div key={sectionKey} className="back-section">
                <span className="back-label">{label}</span>
                {entries.map(([k, v]) => (
                    <p key={k} className="back-text">
                        <strong>{k}：</strong>
                        {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                    </p>
                ))}
            </div>
        )
    }

    return null
}

// ── Schema-driven back-face renderer ──────────────────────────────────────────
// 1. Renders known fields (from CARD_BACK_SCHEMA) first, in defined order
// 2. Falls back to raw key-value for any unrecognised fields
function renderHmwBack(hmw) {
    if (typeof hmw === 'string') {
        return <p className="back-text">（無額外詳情）</p>
    }
    if (!hmw || typeof hmw !== 'object') return null

    const renderedSections = []
    const usedKeys = new Set(HMW_FRONT_KEYS)   // keys already accounted for

    // ── Pass 1: render schema-defined fields ──
    for (const field of CARD_BACK_SCHEMA) {
        let resolved = null
        let matchedKey = null

        for (const key of field.keys) {
            const val = resolveKey(hmw, key)
            if (val !== null && val !== undefined && val !== '' &&
                !(Array.isArray(val) && val.length === 0)) {
                resolved = val
                matchedKey = key.split('.')[0]   // top-level key to mark as used
                break
            }
        }

        if (resolved !== null && resolved !== undefined) {
            const section = renderSection(field.label, resolved, field.type, field.label)
            if (section) {
                renderedSections.push(section)
                if (matchedKey) usedKeys.add(matchedKey)
            }
        }
    }

    // ── Pass 2: render any remaining unknown fields ──
    const remaining = Object.entries(hmw).filter(([k, v]) =>
        !usedKeys.has(k) &&
        v !== null && v !== undefined && v !== '' &&
        !(Array.isArray(v) && v.length === 0)
    )

    for (const [key, value] of remaining) {
        let type = 'text'
        if (Array.isArray(value)) {
            type = value.length > 0 && typeof value[0] === 'object' ? 'quotes' : 'list'
        } else if (typeof value === 'object') {
            type = 'object'
        }
        const section = renderSection(key, value, type, key)
        if (section) renderedSections.push(section)
    }

    if (renderedSections.length === 0) {
        return <p className="back-text">暫無額外詳細資訊</p>
    }

    return renderedSections
}


export default function RoomPage() {

    const router = useRouter()
    const { id: roomId } = router.query

    const [userId, setUserId] = useState(null)
    const [userName, setUserName] = useState('')
    const [room, setRoom] = useState(null)
    const [transcripts, setTranscripts] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)

    // Upload form
    const [uploadMode, setUploadMode] = useState(false)
    const [pendingFiles, setPendingFiles] = useState([])
    const [uploading, setUploading] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const dragCounterRef = useRef(0)

    // Analysis state
    const [analyzing, setAnalyzing] = useState(false)
    const [analysisProgress, setAnalysisProgress] = useState(null)
    const [liveStepResults, setLiveStepResults] = useState([])

    // HMW Results state
    const [hmwResults, setHmwResults] = useState(null)
    const [hmwVotes, setHmwVotes] = useState([])
    const [jtbdItems, setJtbdItems] = useState([])
    const [votingComplete, setVotingComplete] = useState(false)
    const [showStartAnalysisConfirm, setShowStartAnalysisConfirm] = useState(false)
    const [showReanalyzeConfirm, setShowReanalyzeConfirm] = useState(false)
    const [showCancelConfirm, setShowCancelConfirm] = useState(false)
    const [flippedCards, setFlippedCards] = useState({})

    // File input ref for custom styling
    const fileInputRef = useRef(null)

    // Edit transcript state
    const [editingTranscriptId, setEditingTranscriptId] = useState(null)
    const [editContent, setEditContent] = useState('')
    const [editFileName, setEditFileName] = useState('')
    const [saving, setSaving] = useState(false)

    // Analysis mode state
    const [analysisModes, setAnalysisModes] = useState([])
    const [selectedModeId, setSelectedModeId] = useState('')
    const [pendingModeId, setPendingModeId] = useState('')
    const [loadingModes, setLoadingModes] = useState(true)
    const [modeInitialized, setModeInitialized] = useState(false)

    // Analysis history state (for viewing past analysis results)
    const [analysisHistory, setAnalysisHistory] = useState([])
    const [selectedRunId, setSelectedRunId] = useState(null)
    const [currentRunInfo, setCurrentRunInfo] = useState(null)

    useEffect(() => {
        const storedUserId = localStorage.getItem('userId')
        const storedUserName = localStorage.getItem('userName')

        if (!storedUserId) {
            router.push('/login')
            return
        }

        setUserId(storedUserId)
        setUserName(storedUserName || '')
    }, [])

    useEffect(() => {
        if (roomId && userId) {
            fetchRoomData()
            fetchTranscripts()
            fetchAnalysisModes()
        }
    }, [roomId, userId])

    // Once room and modes are both loaded, initialize pendingModeId from room.project_id
    // (overrides the system default set by fetchAnalysisModes)
    useEffect(() => {
        if (!room || analysisModes.length === 0 || modeInitialized) return
        setModeInitialized(true)
        if (room.project_id) {
            const roomMode = analysisModes.find(m => m.id === room.project_id)
            if (roomMode) {
                setPendingModeId(room.project_id)
                setSelectedModeId(room.project_id)
            }
        }
    }, [room, analysisModes, modeInitialized])

    // Fetch available analysis modes
    const fetchAnalysisModes = async () => {
        setLoadingModes(true)
        try {
            const currentUserId = userId || localStorage.getItem('userId')
            const res = await fetch(`/api/projects?userId=${currentUserId}`)
            const data = await res.json()
            if (res.ok) {
                setAnalysisModes(data.projects || [])
                // Auto-select default mode
                const defaultMode = data.projects?.find(p => p.is_default)
                if (defaultMode) {
                    setSelectedModeId(defaultMode.id)
                    setPendingModeId(defaultMode.id)
                } else if (data.projects?.length > 0) {
                    setSelectedModeId(data.projects[0].id)
                    setPendingModeId(data.projects[0].id)
                }
            }
        } catch (err) {
            console.error('Error fetching analysis modes:', err)
        } finally {
            setLoadingModes(false)
        }
    }

    const fetchRoomData = async () => {
        try {
            const res = await fetch(`/api/rooms?code=${roomId}`)
            const data = await res.json()
            if (res.ok) {
                setRoom(data.room)
            } else {
                setError('找不到此房間')
            }
        } catch (err) {
            setError('載入房間資料失敗')
        } finally {
            setLoading(false)
        }
    }

    const fetchTranscripts = async () => {
        try {
            // Need to get room UUID first
            const roomRes = await fetch(`/api/rooms?code=${roomId}`)
            const roomData = await roomRes.json()
            if (!roomRes.ok) return

            const res = await fetch(`/api/transcripts?roomId=${roomData.room.id}`)
            const data = await res.json()
            if (res.ok) {
                setTranscripts(data.transcripts || [])
            }
        } catch (err) {
            console.error('Error fetching transcripts:', err)
        }
    }


    // Fetch HMW results when analysis is completed
    const fetchHmwResults = async (runId = null) => {
        if (!room?.id) return
        try {
            let url = `/api/rooms/results?roomId=${room.id}`
            if (runId) {
                url += `&runId=${runId}`
            }
            const res = await fetch(url)
            const data = await res.json()
            if (res.ok) {
                setHmwResults(data.hmwItems || [])
                setHmwVotes(data.votes || [])
                setJtbdItems(data.jtbdItems || [])
                setAnalysisHistory(data.analysisHistory || [])
                setCurrentRunInfo(data.currentRun || null)
                // Always sync selectedRunId with what the API returned
                if (data.runId) {
                    setSelectedRunId(data.runId)
                }
            }
        } catch (err) {
            console.error('Error fetching HMW results:', err)
        }
    }

    // Fetch results when analysis is completed (including partial completion)
    useEffect(() => {
        if (room?.analysis_status === 'completed' || room?.analysis_status === 'completed_with_errors') {
            fetchHmwResults()
        }
    }, [room?.analysis_status])

    // Handle voting
    const handleVote = async (hmwIndex) => {
        if (!userId || !room?.id) return

        // Check if already voted
        const existingVote = hmwVotes.find(v =>
            v.user_id === userId && v.hmw_index === hmwIndex
        )

        try {
            const res = await fetch(`/api/rooms/results?roomId=${room.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hmwIndex,
                    userId,
                    vote: existingVote ? null : 1,  // Toggle vote
                    runId: selectedRunId
                })
            })
            const data = await res.json()
            if (res.ok) {
                setHmwVotes(data.votes || [])
            }
        } catch (err) {
            console.error('Error voting:', err)
        }
    }

    // Calculate vote count for an HMW item
    const getVoteCount = (hmwIndex) => {
        return hmwVotes.filter(v => v.hmw_index === hmwIndex).length
    }

    // Check if current user voted for an HMW item
    const hasUserVoted = (hmwIndex) => {
        return hmwVotes.some(v => v.user_id === userId && v.hmw_index === hmwIndex)
    }

    // Poll for analysis progress when analyzing
    useEffect(() => {
        if (!room || room.analysis_status !== 'analyzing') {
            setAnalysisProgress(null)
            setLiveStepResults([])
            return
        }

        const pollProgress = async () => {
            try {
                const res = await fetch(`/api/analysis/progress?roomId=${room.id}`)
                const data = await res.json()
                if (res.ok && data.progress) {
                    setAnalysisProgress({
                        ...data.progress,
                        projectName: data.projectName
                    })
                }
                // Update live step results from completed steps (success + error)
                if (res.ok && Array.isArray(data.completedSteps)) {
                    setLiveStepResults(data.completedSteps)
                }
                // If status changed to completed/failed, refresh room data
                if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
                    fetchRoomData()
                }
            } catch (err) {
                console.error('Error polling progress:', err)
            }
        }

        // Initial fetch
        pollProgress()

        // Poll every 3 seconds
        const interval = setInterval(pollProgress, 3000)

        return () => clearInterval(interval)
    }, [room?.id, room?.analysis_status])

    // === Multi-file processing ===
    const processFiles = async (fileList) => {
        const newFiles = []
        for (const file of fileList) {
            const ext = file.name.split('.').pop().toLowerCase()
            const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
            if (!['txt', 'docx', 'pdf'].includes(ext)) {
                newFiles.push({ id, file, fileName: file.name, displayName: file.name.replace(/\.[^/.]+$/, ''), content: '', status: 'error', error: `不支援 .${ext} 格式` })
            } else {
                newFiles.push({ id, file, fileName: file.name, displayName: file.name.replace(/\.[^/.]+$/, ''), content: '', status: 'parsing', error: null })
            }
        }
        setPendingFiles(prev => [...prev, ...newFiles])

        // Parse each file
        for (const pf of newFiles) {
            if (pf.status === 'error') continue
            const ext = pf.file.name.split('.').pop().toLowerCase()
            try {
                let text = ''
                if (ext === 'txt') {
                    text = await new Promise((resolve, reject) => {
                        const reader = new FileReader()
                        reader.onload = (e) => resolve(e.target.result)
                        reader.onerror = () => reject(new Error('讀取檔案失敗'))
                        reader.readAsText(pf.file)
                    })
                } else {
                    const formData = new FormData()
                    formData.append('file', pf.file)
                    const res = await fetch('/api/parse-file', { method: 'POST', body: formData })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error || '檔案解析失敗')
                    text = data.text
                }
                setPendingFiles(prev => prev.map(f => f.id === pf.id ? { ...f, content: text, status: 'ready' } : f))
            } catch (err) {
                setPendingFiles(prev => prev.map(f => f.id === pf.id ? { ...f, status: 'error', error: err.message } : f))
            }
        }
    }

    const handleMultiFileSelect = (e) => {
        const files = Array.from(e.target.files)
        if (files.length > 0) processFiles(files)
        e.target.value = '' // reset so same file can be re-selected
    }

    const handleFileDrop = (e) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounterRef.current = 0
        setIsDragging(false)
        const files = Array.from(e.dataTransfer.files)
        if (files.length > 0) processFiles(files)
    }

    const handleDragEnter = (e) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounterRef.current++
        setIsDragging(true)
    }

    const handleDragOver = (e) => {
        e.preventDefault()
        e.stopPropagation()
    }

    const handleDragLeave = (e) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounterRef.current--
        if (dragCounterRef.current <= 0) {
            dragCounterRef.current = 0
            setIsDragging(false)
        }
    }

    const removePendingFile = (id) => {
        setPendingFiles(prev => prev.filter(f => f.id !== id))
    }

    const handleBatchUpload = async () => {
        const readyFiles = pendingFiles.filter(f => f.status === 'ready')
        if (readyFiles.length === 0) {
            setError('沒有可上傳的檔案，請先加入檔案')
            return
        }
        setUploading(true)
        setError(null)
        setSuccess(null)

        let successCount = 0
        let failCount = 0
        for (const pf of readyFiles) {
            try {
                const res = await fetch('/api/transcripts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        room_id: room.id,
                        uploader_id: userId,
                        file_name: pf.displayName || `逐字稿 ${transcripts.length + successCount + 1}`,
                        content: pf.content
                    })
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data.error)
                successCount++
            } catch {
                failCount++
            }
        }

        if (successCount > 0) {
            setSuccess(`✅ 成功上傳 ${successCount} 份逐字稿${failCount > 0 ? `，${failCount} 份失敗` : ''}`)
            fetchTranscripts()
        } else {
            setError('所有檔案上傳失敗')
        }
        setPendingFiles([])
        setUploadMode(false)
        setUploading(false)
    }

    const handleStartAnalysis = async () => {
        if (transcripts.length === 0) {
            setError('請先上傳至少一份逐字稿')
            return
        }

        setAnalyzing(true)
        setError(null)
        setSuccess(null)

        try {
            const res = await fetch('/api/analysis/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId: room.id,
                    initiatorId: userId,
                    projectId: pendingModeId
                })
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || '啟動分析失敗')
            }

            setSuccess('✨ 分析已開始！分析完成後會在此頁面顯示結果。')
            // Refresh room data to get updated analysis status
            fetchRoomData()
        } catch (err) {
            setError(err.message)
        } finally {
            setAnalyzing(false)
        }
    }

    const handleCancelAnalysis = () => {
        setShowCancelConfirm(true)
    }

    const confirmCancelAnalysis = async () => {
        setShowCancelConfirm(false)

        try {
            const res = await fetch('/api/analysis/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    runId: room.current_analysis_run_id,
                    roomId: room.id
                })
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || '取消分析失敗')
            }

            setSuccess('分析已取消')
            fetchRoomData()
        } catch (err) {
            setError(err.message)
        }
    }

    // Handle re-analyze - open confirmation modal
    const handleReanalyzeClick = () => {
        setShowReanalyzeConfirm(true)
    }

    // Confirm re-analyze (called from modal)
    const confirmReanalyze = async () => {
        setShowReanalyzeConfirm(false)

        try {
            setAnalyzing(true)
            setError(null)

            // Reset room status first
            const resetRes = await fetch('/api/debug/fix-run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'reset_room',
                    roomId: room.id
                })
            })

            if (!resetRes.ok) {
                throw new Error('重置房間狀態失敗')
            }

            // Start new analysis
            // Use pendingModeId (the user's current modal selection). selectedModeId
            // is updated via async setState and would still hold the stale value here.
            const res = await fetch('/api/analysis/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId: room.id,
                    initiatorId: userId,
                    projectId: pendingModeId
                })
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || '重新分析啟動失敗')
            }

            setSuccess('重新分析已啟動！')
            fetchRoomData()
        } catch (err) {
            setError(err.message)
        } finally {
            setAnalyzing(false)
        }
    }

    const handleDeleteTranscript = async (transcriptId) => {
        if (!confirm('確定要刪除此逐字稿嗎？')) return

        try {
            const res = await fetch('/api/transcripts', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: transcriptId })
            })

            if (res.ok) {
                fetchTranscripts()
            }
        } catch (err) {
            console.error('Delete error:', err)
        }
    }

    const handleEditTranscript = (transcript) => {
        setEditingTranscriptId(transcript.id)
        setEditContent(transcript.content)
        setEditFileName(transcript.file_name || '')
    }

    const handleCancelEdit = () => {
        setEditingTranscriptId(null)
        setEditContent('')
        setEditFileName('')
    }

    const handleSaveTranscript = async () => {
        if (!editingTranscriptId) return

        setSaving(true)
        try {
            const res = await fetch('/api/transcripts', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingTranscriptId,
                    file_name: editFileName,
                    content: editContent
                })
            })

            if (res.ok) {
                setSuccess('逐字稿已更新')
                fetchTranscripts()
                handleCancelEdit()
            } else {
                const data = await res.json()
                setError(data.error || '更新失敗')
            }
        } catch (err) {
            console.error('Save error:', err)
            setError('更新失敗')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="room-page">
                <div className="room-loading">載入中...</div>
            </div>
        )
    }

    if (!room) {
        return (
            <div className="room-page">
                <div className="room-error-page">
                    <h1>找不到房間</h1>
                    <p>房間代碼：{roomId}</p>
                    <a href="/dashboard" className="btn btn-primary">返回 Dashboard</a>
                </div>
            </div>
        )
    }

    /* ── helper for priority badge class ── */
    const getPriorityClass = (p) => {
        if (!p) return 'priority-tag-default'
        const lower = String(p).toLowerCase()
        if (lower === '高' || lower === 'high') return 'priority-tag-high'
        if (lower === '中' || lower === 'medium') return 'priority-tag-medium'
        return 'priority-tag-low'
    }

    return (
        <div className="room-page">

            {/* ===== Header ===== */}
            <header className="room-header">
                <div className="room-header-left">
                    <a href="/dashboard" className="room-back-link">← 返回</a>
                    <span className="room-title">{room.name}</span>
                    <span className="room-code-chip">代碼：{room.room_code}</span>
                </div>
                <div className="room-header-right">
                    <span className="room-user-tag">👋 {userName}</span>
                </div>
            </header>

            <main className="room-main">
                {/* Room Info */}
                <div className="room-info-grid">
                    <div className="room-info-item">
                        <span className="room-info-label">研究主題</span>
                        <span className="room-info-value">{room.research_topic}</span>
                    </div>
                    <div className="room-info-item">
                        <span className="room-info-label">研究目的</span>
                        <span className="room-info-value">{room.research_purpose}</span>
                    </div>
                </div>

                {error && <div className="alert alert-error">{error}</div>}
                {success && <div className="alert alert-success">{success}</div>}

                {/* ===== Transcripts Section ===== */}
                <div className="room-section">
                    <div className="room-section-header">
                        <h2 className="room-section-title">📄 逐字稿列表</h2>
                        <button
                            onClick={() => {
                                const newMode = !uploadMode
                                setUploadMode(newMode)
                                if (newMode) {
                                    setPendingFiles([])
                                    setError(null)
                                    setSuccess(null)
                                }
                            }}
                            className={`btn ${uploadMode ? 'btn-ghost' : 'btn-primary'} btn-sm`}
                        >
                            {uploadMode ? '取消' : '＋ 新增逐字稿'}
                        </button>
                    </div>

                    {/* Upload Form */}
                    {uploadMode && (
                        <div className="upload-form">
                            <div
                                className={`drop-zone ${isDragging ? 'drop-zone-active' : ''}`}
                                onDragEnter={handleDragEnter}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleFileDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept=".txt,.docx,.pdf"
                                    multiple
                                    onChange={handleMultiFileSelect}
                                    className="file-input-hidden"
                                />
                                <div className="drop-zone-icon">📁</div>
                                <p className="drop-zone-text">
                                    {isDragging ? '放開以加入檔案' : '拖曳檔案到此處，或點擊選擇檔案'}
                                </p>
                                <p className="drop-zone-hint">支援 .txt, .docx, .pdf，可同時選取多個檔案</p>
                            </div>

                            {pendingFiles.length > 0 && (
                                <div className="pending-files-list">
                                    <div className="pending-files-header">
                                        <span className="pending-files-title">📋 待上傳檔案 ({pendingFiles.filter(f => f.status === 'ready').length}/{pendingFiles.length})</span>
                                    </div>
                                    {pendingFiles.map(pf => (
                                        <div key={pf.id} className={`pending-file-item pending-file-${pf.status}`}>
                                            <span className="pending-file-status-icon">
                                                {pf.status === 'parsing' ? '⏳' : pf.status === 'ready' ? '✅' : '❌'}
                                            </span>
                                            <span className="pending-file-name">{pf.fileName}</span>
                                            {pf.error && <span className="pending-file-error-msg">{pf.error}</span>}
                                            <button
                                                type="button"
                                                className="pending-file-remove"
                                                onClick={() => removePendingFile(pf.id)}
                                                title="移除"
                                            >✕</button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <button
                                onClick={handleBatchUpload}
                                className="btn btn-primary"
                                disabled={uploading || pendingFiles.filter(f => f.status === 'ready').length === 0}
                            >
                                {uploading ? '上傳中...' : `📤 上傳 ${pendingFiles.filter(f => f.status === 'ready').length} 份逐字稿`}
                            </button>
                        </div>
                    )}

                    {/* Transcripts List */}
                    {transcripts.length > 0 ? (
                        <div className="transcripts-list">
                            {transcripts.map((transcript, index) => {
                                const isEditing = editingTranscriptId === transcript.id
                                return (
                                    <div key={transcript.id} className={`transcript-card ${isEditing ? 'transcript-card-editing' : ''}`}>
                                        <div className="transcript-header">
                                            <span className="transcript-number">#{index + 1}</span>
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={editFileName}
                                                    onChange={e => setEditFileName(e.target.value)}
                                                    className="form-input"
                                                    placeholder="逐字稿名稱"
                                                    style={{ flex: 1 }}
                                                />
                                            ) : (
                                                <span className="transcript-name">{transcript.file_name}</span>
                                            )}
                                        </div>
                                        <div className="transcript-meta">
                                            <span>上傳者：{transcript.users?.name || '未知'}</span>
                                            <span>{new Date(transcript.created_at).toLocaleDateString('zh-TW')}</span>
                                        </div>

                                        {isEditing ? (
                                            <textarea
                                                value={editContent}
                                                onChange={e => setEditContent(e.target.value)}
                                                className="form-textarea"
                                                rows={12}
                                            />
                                        ) : (
                                            <div className="transcript-preview">
                                                {transcript.content.substring(0, 200)}...
                                            </div>
                                        )}

                                        <div className="transcript-actions">
                                            {isEditing ? (
                                                <>
                                                    <button onClick={handleSaveTranscript} className="btn btn-success btn-sm" disabled={saving}>
                                                        {saving ? '儲存中...' : '💾 儲存'}
                                                    </button>
                                                    <button onClick={handleCancelEdit} className="btn btn-ghost btn-sm" disabled={saving}>
                                                        取消
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => handleEditTranscript(transcript)} className="btn btn-ghost btn-sm">
                                                        ✏️ 編輯
                                                    </button>
                                                    <button onClick={() => handleDeleteTranscript(transcript.id)} className="btn btn-danger btn-sm">
                                                        刪除
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <p>尚無逐字稿</p>
                            <p className="empty-state-hint">點擊上方「新增逐字稿」開始上傳</p>
                        </div>
                    )}
                </div>

                {/* ===== Analysis Action Section (mode selector + start) ===== */}
                <div className={`analysis-section ${room.analysis_status === 'analyzing' ? 'analysis-section-processing' : ''} ${room.analysis_status === 'completed' ? 'analysis-section-completed' : ''}`}>


                    <div className="analysis-info">
                        <span className="transcript-count">已上傳 {transcripts.length} 份逐字稿</span>

                        {room.analysis_status === 'analyzing' && (
                            <div className="analysis-progress-container">
                                <span className="badge badge-analyzing">🔄 分析進行中...</span>
                                {analysisProgress && (
                                    <div className="progress-wrapper">
                                        {analysisProgress.projectName && (
                                            <div className="project-name-badge">
                                                📁 使用專案：{analysisProgress.projectName}
                                            </div>
                                        )}
                                        <div className="progress-info-row">
                                            <span className="progress-step">
                                                步驟 {analysisProgress.currentStep}/{analysisProgress.totalSteps}: {analysisProgress.currentStepTitle}
                                            </span>
                                            <span className="progress-percent">{analysisProgress.progressPercent}%</span>
                                        </div>
                                        <div className="progress-bar-outer">
                                            <div
                                                className="progress-bar-inner"
                                                style={{ width: `${analysisProgress.progressPercent}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Live step results */}
                                {liveStepResults.length > 0 && (
                                    <div className="live-steps-container">
                                        <p className="live-steps-label">✅ 已完成步驟</p>
                                        {liveStepResults.map((step, i) => (
                                            <LiveStepCard key={i} step={step} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {room.analysis_status === 'completed' && (
                            <span className="badge badge-completed">✅ 分析已完成</span>
                        )}

                        {room.analysis_status === 'failed' && (
                            <div className="analysis-failed-notice">
                                <span className="badge badge-failed">⚠️ 分析失敗</span>
                                <p className="analysis-failed-message">分析因連線逾時中斷，請重新執行分析</p>
                            </div>
                        )}
                    </div>

                    {room.analysis_status !== 'completed' && (
                        <div className="analysis-button-group">
                            <button
                                onClick={() => setShowStartAnalysisConfirm(true)}
                                className={`btn btn-primary ${transcripts.length === 0 || room.analysis_status === 'analyzing' ? 'btn-disabled' : ''}`}
                                disabled={transcripts.length === 0 || analyzing || room.analysis_status === 'analyzing'}
                            >
                                {analyzing ? '準備分析中...' :
                                    room.analysis_status === 'analyzing' ? '🔄 分析進行中...' :
                                    room.analysis_status === 'failed' ? '🔄 重新執行分析' :
                                        '✨ 下一步：確認開始分析'}
                            </button>
                            {room.analysis_status === 'analyzing' && (
                                <button onClick={handleCancelAnalysis} className="btn btn-danger">
                                    ⛔ 取消分析
                                </button>
                            )}
                        </div>
                    )}

                    {room.analysis_status === 'completed' && (
                        <div className="analysis-button-group">
                            {hmwResults && hmwResults.length > 0 && (
                                <span className="results-ready-badge">
                                    🎉 分析完成！共產出 {hmwResults.length} 個 HMW 問句
                                </span>
                            )}
                            <button onClick={handleReanalyzeClick} className="btn btn-ghost" disabled={analyzing}>
                                🔄 重新分析
                            </button>
                        </div>
                    )}
                </div>


                {/* ===== HMW Results Section ===== */}
                {(room.analysis_status === 'completed' || room.analysis_status === 'completed_with_errors') && hmwResults && hmwResults.length > 0 && (
                    <div className="hmw-section">
                        <div className="hmw-section-header">
                            <h2 className="hmw-title">📦 {room.research_topic || '分析結果'} - 投票區</h2>
                            <p className="hmw-user-stats">
                                👋 {room.creator_id === userId ? '主持人' : '參與者'} |
                                已投 {hmwVotes.filter(v => v.user_id === userId).length} / {room.max_votes || 3} 票 |
                                最少需投 {room.min_votes || 1} 票
                            </p>
                        </div>

                        {/* History Selector */}
                        {analysisHistory.length > 1 && (
                            <div className="history-selector">
                                <label className="form-label">📊 分析記錄：</label>
                                <select
                                    value={selectedRunId || ''}
                                    onChange={e => setSelectedRunId(e.target.value)}
                                    className="form-select"
                                >
                                    {analysisHistory.map((run, idx) => (
                                        <option key={run.id} value={run.id}>
                                            {new Date(run.finished_at).toLocaleString('zh-TW')} - {run.projects?.name || '未知模式'}
                                            {idx === 0 ? ' (最新)' : ''}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => fetchHmwResults(selectedRunId)}
                                    className="btn btn-primary btn-sm"
                                    disabled={!selectedRunId}
                                >
                                    <Search size={16} /> 查詢
                                </button>
                            </div>
                        )}

                        {currentRunInfo && (
                            <div className="current-run-info">
                                🔬 分析模式：{currentRunInfo.projects?.name || '預設模式'}
                            </div>
                        )}

                        <div className="hmw-cards-grid">
                            {hmwResults.map((hmw, index) => {
                                const voteCount = getVoteCount(index)
                                const userVoted = hasUserVoted(index)
                                const isFlipped = flippedCards[index]

                                const hmwText = typeof hmw === 'string' ? hmw : (
                                    hmw.HMW_question || hmw.hmw_question || hmw.question ||
                                    hmw['HMW 問題'] || hmw['HMW問題'] || hmw['hmw_問題'] ||
                                    hmw.hmw || hmw.statement || hmw.text ||
                                    Object.values(hmw).find(v => typeof v === 'string' && (v.includes('HMW') || v.includes('如何'))) ||
                                    JSON.stringify(hmw)
                                )
                                const priority = hmw.priority || hmw.importance || hmw['優先級'] || null

                                return (
                                    <div
                                        key={index}
                                        className="hmw-card-container"
                                    >
                                        <div className={`hmw-card-inner ${isFlipped ? 'hmw-card-flipped' : ''}`}>
                                            {/* Front: clicking anywhere flips to back */}
                                            <div
                                                className={`hmw-card-face hmw-card-front ${userVoted ? 'hmw-card-voted' : ''}`}
                                                onClick={() => setFlippedCards(prev => ({ ...prev, [index]: !prev[index] }))}
                                            >
                                                {voteCount > 0 && (
                                                    <span className="crown-badge">
                                                        {voteCount >= 3 ? '👑' : voteCount >= 2 ? '🥈' : '🥉'}
                                                    </span>
                                                )}
                                                <p className="hmw-text">{hmwText}</p>
                                                <div className="hmw-card-footer">
                                                    <span className={`priority-tag ${getPriorityClass(priority)}`}>
                                                        {priority || 'general'}
                                                    </span>
                                                    <button
                                                        onClick={e => { e.stopPropagation(); handleVote(index) }}
                                                        className={`vote-btn ${userVoted ? 'vote-btn-active' : ''}`}
                                                    >
                                                        👍 {voteCount}
                                                    </button>
                                                </div>
                                                <p className="flip-hint">點擊翻面查看詳情 →</p>
                                            </div>

                                            {/* Back: block all propagation so scrolling works freely */}
                                            <div
                                                className="hmw-card-face hmw-card-back"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <h4 className="back-title">📋 詳細資訊</h4>
                                                {renderHmwBack(hmw)}
                                                {/* Dedicated flip-back button */}
                                                <button
                                                    className="flip-back-btn"
                                                    onClick={e => {
                                                        e.stopPropagation()
                                                        setFlippedCards(prev => ({ ...prev, [index]: !prev[index] }))
                                                    }}
                                                >
                                                    ← 翻回正面
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )

                            })}
                        </div>



                        <div className="voting-summary">
                            <p>📊 目前共有 {hmwVotes.length} 票 | 您已投 {hmwVotes.filter(v => v.user_id === userId).length} 票</p>
                        </div>
                    </div>
                )}
            </main>

            {/* Start Analysis Confirmation Modal */}
            {showStartAnalysisConfirm && (
                <div className="modal-overlay" onClick={() => setShowStartAnalysisConfirm(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h3 className="modal-title">✨ 確認開始分析</h3>
                        <p className="modal-body">請選擇分析模式，確認後開始分析。</p>

                        <div className="modal-mode-row">
                            <label className="modal-mode-label">分析模式</label>
                            {loadingModes ? (
                                <span>載入中...</span>
                            ) : (
                                <select
                                    value={pendingModeId}
                                    onChange={e => setPendingModeId(e.target.value)}
                                    className="form-select"
                                >
                                    <option value="">-- 請選擇分析模式 --</option>
                                    {analysisModes.map(mode => (
                                        <option key={mode.id} value={mode.id}>
                                            {mode.name} {mode.is_default ? '⭐' : ''}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <div className="modal-actions">
                            <button onClick={() => setShowStartAnalysisConfirm(false)} className="btn btn-ghost btn-full">取消</button>
                            <button
                                onClick={() => { setShowStartAnalysisConfirm(false); handleStartAnalysis() }}
                                className="btn btn-primary btn-full"
                                disabled={!pendingModeId}
                            >
                                確認開始分析
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reanalyze Confirmation Modal */}
            {showReanalyzeConfirm && (
                <div className="modal-overlay" onClick={() => setShowReanalyzeConfirm(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h3 className="modal-title">🔄 重新分析</h3>
                        <p className="modal-body">請選擇分析模式，確認後將新增一筆分析結果（歷史紀錄將完整保留）。</p>

                        {/* Mode selector inside modal */}
                        <div className="modal-mode-row">
                            <label className="modal-mode-label">分析模式</label>
                            {loadingModes ? (
                                <span>載入中...</span>
                            ) : (
                                <select
                                    value={pendingModeId}
                                    onChange={e => setPendingModeId(e.target.value)}
                                    className="form-select"
                                >
                                    <option value="">-- 請選擇分析模式 --</option>
                                    {analysisModes.map(mode => (
                                        <option key={mode.id} value={mode.id}>
                                            {mode.name} {mode.is_default ? '⭐' : ''}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <div className="modal-actions">
                            <button onClick={() => setShowReanalyzeConfirm(false)} className="btn btn-ghost btn-full">取消</button>
                            <button
                                onClick={confirmReanalyze}
                                className="btn btn-primary btn-full"
                            >
                                確認重新分析
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* Cancel Analysis Confirmation Modal */}
            {showCancelConfirm && (
                <div className="modal-overlay" onClick={() => setShowCancelConfirm(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h3 className="modal-title">⛔ 確認取消分析</h3>
                        <p className="modal-body">確定要取消目前的分析嗎？已完成的步驟結果會被保留。</p>
                        <div className="modal-actions">
                            <button onClick={() => setShowCancelConfirm(false)} className="btn btn-ghost btn-full">繼續分析</button>
                            <button onClick={confirmCancelAnalysis} className="btn btn-danger btn-full">確認取消</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
